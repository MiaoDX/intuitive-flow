import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  bakeoffPrompt,
  candidateMappedEnv,
  CandidateScorecard,
  executeBakeoff,
  normalizeManifest,
  parseResultStatus,
  parseManifestText,
  proposalText,
  proposeCandidates,
  redactText,
  renderCandidateCommand,
  validateManifest,
  writeFinalReport,
  writeScorecard,
} from "./run_plan_bakeoff";

const repoRoot = process.cwd();

const git = (cwd: string, args: string[]) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
};

const createTempRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "plan-bakeoff-repo-"));
  git(dir, ["init"]);
  git(dir, ["config", "user.name", "Plan Bakeoff Test"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  writeFileSync(join(dir, "plan.md"), "# Plan\n\nDo a fake task.\n");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { check: "true" } }, null, 2) + "\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "init"]);
  return dir;
};

const sampleScorecard = (overrides: Partial<CandidateScorecard> = {}): CandidateScorecard => ({
  candidate_id: "candidate-a",
  status: "SUCCESS",
  worker_status: "SUCCESS",
  base_ref: "abc123",
  worktree: "/tmp/worktree",
  branch: "plan-bakeoff/test/candidate-a",
  run_dir: "/tmp/run",
  verification: [{ command: "bun test", status: "pass", output: "ok" }],
  diff_stats: { files_changed: 1, insertions: 2, deletions: 0 },
  route: { harness: "fake", provider_profile: "", model: "" },
  diagnostics: { reason: "", output_tail: "", artifacts: [] },
  ...overrides,
});

describe("plan-bakeoff runner", () => {
  test("parses JSON manifest and normalizes target paths", () => {
    const repo = createTempRepo();
    try {
      const manifestPath = join(repo, "manifest.json");
      writeFileSync(
        manifestPath,
        JSON.stringify({
          schema: "plan_bakeoff_manifest_v1",
          target_repo: ".",
          plan: "plan.md",
          candidates: [
            { id: "a", harness: "fake" },
            { id: "b", harness: "fake" },
          ],
        }),
      );

      const manifest = normalizeManifest(parseManifestText(readFileSync(manifestPath, "utf8")), manifestPath);
      expect(manifest.target_repo).toBe(repo);
      expect(manifest.plan).toBe(join(repo, "plan.md"));
      expect(manifest.base?.mode).toBe("clean-head");
      expect(manifest.execution?.parallel).toBe(true);
      expect(manifest.execution?.worker_timeout_min).toBe(60);
      expect(manifest.execution?.timeout_grace_min).toBe(15);
      expect(manifest.candidates[0].runtime).toBe("host");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("rejects non-JSON manifests", () => {
    expect(() => parseManifestText("schema: plan_bakeoff_manifest_v1")).toThrow();
  });

  test("rejects docker runtime during manifest normalization", () => {
    expect(() =>
      normalizeManifest(
        {
          schema: "plan_bakeoff_manifest_v1",
          target_repo: repoRoot,
          plan: join(repoRoot, ".planning", "plan-bakeoff-skill.md"),
          candidates: [
            { id: "a", harness: "fake", runtime: "docker" },
            { id: "b", harness: "fake" },
          ],
        },
        join(repoRoot, "manifest.json"),
      ),
    ).toThrow("unsupported runtime for a: docker");
  });

  test("validates missing env, unsupported docker runtime, and gated real harnesses", () => {
    const errors = validateManifest(
      {
        schema: "plan_bakeoff_manifest_v1",
        target_repo: repoRoot,
        plan: join(repoRoot, ".planning", "plan-bakeoff-skill.md"),
        candidates: [
          { id: "a", harness: "fake", required_env: ["MISSING_TEST_KEY"], runtime: "docker" },
          { id: "b", harness: "codex-cli", env: { CODEX_API_KEY: "MISSING_CODEX_API_KEY" } },
        ],
      },
      {},
    );

    expect(errors).toContain("candidate a: docker runtime is unsupported");
    expect(errors).toContain("candidate a: missing required env MISSING_TEST_KEY");
    expect(errors).toContain("candidate b: real harness requires --execute-real");
    expect(errors).not.toContain("candidate b: missing required env MISSING_CODEX_API_KEY");
  });

  test("allows real harness validation when execute-real is explicit", () => {
    const errors = validateManifest(
      {
        schema: "plan_bakeoff_manifest_v1",
        target_repo: repoRoot,
        plan: join(repoRoot, ".planning", "plan-bakeoff-skill.md"),
        candidates: [
          { id: "codex", harness: "codex-cli", required_env: ["CODEX_API_KEY"], env: { CODEX_API_KEY: "CODEX_API_KEY" } },
          { id: "fake", harness: "fake" },
        ],
      },
      { CODEX_API_KEY: "fake-codex-key" },
      { allowReal: true },
    );

    expect(errors).toEqual([]);
  });

  test("redacts known secret values", () => {
    const env = {
      CODEX_API_KEY: "fake-redaction-secret-value",
      CODEX_BASE_URL: "https://secret.example.test/v1",
    };

    const authHeader = `Authorization: ${"Bearer"} ${env.CODEX_API_KEY}`;
    expect(redactText(`${authHeader}\n${env.CODEX_BASE_URL}`, env)).not.toContain(
      env.CODEX_API_KEY,
    );
    expect(redactText(`url=${env.CODEX_BASE_URL}`, env)).toContain("[REDACTED]");
  });

  test("proposes only built-in candidates with available env", () => {
    const env = {
      CODEX_BASE_URL: "https://codex.example.test/v1",
      CODEX_API_KEY: "fake-codex-key",
      MM_API_KEY: "fake-mm-key",
      MIMO_API_KEY: "fake-mimo-key",
      MIMO_BASE_URL: "https://mimo.example.test/v1",
      KIMI_API_KEY: "fake-kimi-key",
    };
    const candidates = proposeCandidates(env);

    expect(candidates.map((candidate) => candidate.id)).toEqual([
      "codex-gpt-5.5",
      "codex-gpt-5.3-codex",
      "codex-minimax",
      "claude-mimo-1000",
      "claude-kimi",
      "claude-minimax",
    ]);
    expect(candidates[0].env).toEqual({ CODEX_BASE_URL: "CODEX_BASE_URL", CODEX_API_KEY: "CODEX_API_KEY" });
    expect(candidates[3].model).toBe("mimo-1000");
    expect(candidates[4].model).toBe("kimi-k2.7-code");
  });

  test("renders real harness commands without inline secrets", () => {
    const codex = renderCandidateCommand(
      {
        id: "codex",
        harness: "codex-cli",
        provider_profile: "codex-router-responses",
        model: "gpt-5.5",
        required_env: ["CODEX_API_KEY"],
      },
      "/tmp/last-message.md",
      { CODEX_BASE_URL: "https://codex.example.test/v1" },
    ).join(" ");
    const minimax = renderCandidateCommand(
      {
        id: "minimax",
        harness: "codex-cli",
        provider_profile: "minimax-responses",
        model: "MiniMax-M3",
        required_env: ["MM_API_KEY"],
      },
      "/tmp/last-message.md",
      { MM_BASE_URL: "https://minimax.example.test/v1", MM_API_KEY: "fake-mm-key" },
    ).join(" ");
    const claude = renderCandidateCommand(
      {
        id: "claude",
        harness: "claude-code",
        model: "sonnet",
        required_env: ["ANTHROPIC_API_KEY"],
      },
      "/tmp/last-message.md",
    ).join(" ");

    expect(codex).toContain("codex exec");
    expect(codex).toContain("model_provider");
    expect(codex).not.toContain("fake-codex-key");
    expect(minimax).toContain("minimax-responses");
    expect(minimax).toContain("MM_API_KEY");
    expect(minimax).not.toContain("fake-mm-key");
    expect(claude).toContain("claude -p");
    expect(claude).toContain("--verbose");
    expect(claude).toContain("--permission-mode auto");
    expect(claude).toContain("--model sonnet");
  });

  test("maps Claude-compatible local provider env", () => {
    expect(
      candidateMappedEnv(
        {
          id: "mimo",
          harness: "claude-code",
          provider_profile: "mimo-ultraspeed-anthropic",
          env: {
            ANTHROPIC_AUTH_TOKEN: "MIMO_API_KEY",
            ANTHROPIC_BASE_URL: "MIMO_BASE_URL",
          },
        },
        {
          MIMO_API_KEY: "fake-mimo-key",
          MIMO_BASE_URL: "https://mimo.example.test/v1",
        },
      ),
    ).toEqual({
      ANTHROPIC_AUTH_TOKEN: "fake-mimo-key",
      ANTHROPIC_BASE_URL: "https://mimo.example.test",
    });
    expect(
      candidateMappedEnv(
        {
          id: "minimax",
          harness: "claude-code",
          provider_profile: "minimax-anthropic",
          env: {
            ANTHROPIC_AUTH_TOKEN: "MM_API_KEY",
            ANTHROPIC_BASE_URL: "MM_BASE_URL",
          },
        },
        {
          MM_API_KEY: "fake-mm-key",
          MM_BASE_URL: "https://api.minimaxi.com/v1",
        },
      ),
    ).toEqual({
      ANTHROPIC_AUTH_TOKEN: "fake-mm-key",
      ANTHROPIC_BASE_URL: "https://api.minimaxi.com/anthropic",
    });
  });

  test("writes proposal text without secret values", () => {
    const manifest = {
      schema: "plan_bakeoff_manifest_v1",
      target_repo: repoRoot,
      plan: join(repoRoot, ".planning", "plan-bakeoff-skill.md"),
      candidates: [
        { id: "fake-a", harness: "fake" },
        { id: "fake-b", harness: "fake" },
      ],
    };
    const text = proposalText(manifest, proposeCandidates({ CODEX_BASE_URL: "secret-url", CODEX_API_KEY: "secret-key" }));

    expect(text).toContain("codex-gpt-5.5");
    expect(text).not.toContain("secret-key");
    expect(text).not.toContain("secret-url");
  });

  test("candidate prompt avoids nested skill-runner orchestration", () => {
    const repo = createTempRepo();
    try {
      const plan = join(repo, "plan.md");
      const prompt = bakeoffPrompt(
        {
          schema: "plan_bakeoff_manifest_v1",
          target_repo: repo,
          plan,
          candidates: [
            { id: "fake-a", harness: "fake" },
            { id: "fake-b", harness: "fake" },
          ],
        },
        { id: "fake-a", harness: "fake" },
      );

      expect(prompt).toContain("directly in this worktree");
      expect(prompt).toContain("# Plan");
      expect(prompt).toContain("Do a fake task.");
      expect(prompt).toContain("Do not delegate to skill-runner, tmux, or another coding agent");
      expect(prompt).not.toContain("$intuitive-flow");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("parses direct RESULT_STATUS lines and skill-runner result markdown", () => {
    expect(parseResultStatus("RESULT_STATUS: SUCCESS\nSUMMARY: ok")).toBe("SUCCESS");
    expect(parseResultStatus("RESULT_STATUS: BLOCKED_NEEDS_DECISION\nOPEN_DECISIONS: input")).toBe("BLOCKED");
    expect(parseResultStatus("# Skill Runner Result\n\n- Status: PARTIAL\n- Reason: worker reported")).toBe("PARTIAL");
    expect(parseResultStatus("SUMMARY: missing status")).toBe("UNKNOWN");
  });

  test("writes scorecard diagnostics for failed candidates", () => {
    const dir = mkdtempSync(join(tmpdir(), "plan-bakeoff-scorecard-"));
    try {
      writeScorecard(
        sampleScorecard({
          status: "FAILED",
          worker_status: "UNKNOWN",
          diagnostics: {
            reason: "no parseable worker status; exit code 1",
            output_tail: "stderr token [REDACTED]",
            artifacts: [{ name: "stderr.log", tail: "command failed" }],
          },
        }),
        dir,
      );

      const markdown = readFileSync(join(dir, "scorecard.md"), "utf8");
      const json = readFileSync(join(dir, "scorecard.json"), "utf8");
      expect(markdown).toContain("Diagnostic reason: no parseable worker status; exit code 1");
      expect(markdown).toContain("## Diagnostics");
      expect(markdown).toContain("stderr.log");
      expect(json).toContain('"diagnostics"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("final report includes verification counts and candidate diagnostics", () => {
    const dir = mkdtempSync(join(tmpdir(), "plan-bakeoff-report-"));
    try {
      writeFinalReport(dir, [
        sampleScorecard({ candidate_id: "clean" }),
        sampleScorecard({
          candidate_id: "broken",
          status: "FAILED",
          worker_status: "UNKNOWN",
          verification: [
            { command: "bun test", status: "pass", output: "ok" },
            { command: "git diff --check", status: "fail", output: "bad whitespace" },
          ],
          diagnostics: {
            reason: "no parseable worker status; exit code 1",
            output_tail: "failed",
            artifacts: [{ name: "result.md", tail: "- Reason: failed" }],
          },
        }),
      ]);

      const report = readFileSync(join(dir, "final-report.md"), "utf8");
      expect(report).toContain("## Verification Summary");
      expect(report).toContain("- clean: 1 pass, 0 fail");
      expect(report).toContain("- broken: 1 pass, 1 fail");
      expect(report).toContain("## Candidate Diagnostics");
      expect(report).toContain("- broken: no parseable worker status; exit code 1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("executes three fake candidates in independent worktrees", async () => {
    const repo = createTempRepo();
    const runRoot = mkdtempSync(join(tmpdir(), "plan-bakeoff-run-root-"));
    const home = mkdtempSync(join(tmpdir(), "plan-bakeoff-home-"));
    const codexConfig = join(home, ".codex", "config.toml");
    const claudeSettings = join(home, ".claude", "settings.json");
    try {
      const manifest = normalizeManifest(
        {
          schema: "plan_bakeoff_manifest_v1",
          target_repo: repo,
          plan: join(repo, "plan.md"),
          run_root: runRoot,
          verification: { commands: ["test -f plan.md"] },
          candidates: [
            { id: "fake-a", harness: "fake", command_profile: "fake-success", skills: ["intuitive-flow"] },
            { id: "fake-b", harness: "fake", command_profile: "fake-partial" },
            { id: "fake-c", harness: "fake", command_profile: "fake-success" },
          ],
        },
        join(repo, "manifest.json"),
      );
      const runDir = await executeBakeoff(manifest, {
        env: {
          ...process.env,
          HOME: home,
          CODEX_HOME: join(home, ".codex"),
        },
      });

      expect(existsSync(join(runDir, "final-report.md"))).toBe(true);
      const finalReport = readFileSync(join(runDir, "final-report.md"), "utf8");
      expect(finalReport).toContain("winner: fake-a");
      expect(finalReport).toContain("- fake-a: 1 pass, 0 fail");
      expect(finalReport).toContain("- fake-b: 1 pass, 0 fail");
      expect(finalReport).toContain("- fake-b: worker reported RESULT_STATUS: PARTIAL; cli exit code 0");
      for (const id of ["fake-a", "fake-b", "fake-c"]) {
        expect(existsSync(join(runDir, "candidates", id, "scorecard.json"))).toBe(true);
      }
      expect(readFileSync(join(runDir, "candidates", "fake-a", "scorecard.json"), "utf8")).toContain('"status": "SUCCESS"');
      expect(readFileSync(join(runDir, "candidates", "fake-b", "scorecard.json"), "utf8")).toContain('"status": "PARTIAL"');
      expect(readFileSync(join(runDir, "candidates", "fake-b", "scorecard.md"), "utf8")).toContain("## Diagnostics");
      expect(git(repo, ["worktree", "list", "--porcelain"]).stdout).not.toContain(runDir);
      expect(existsSync(codexConfig)).toBe(false);
      expect(existsSync(claudeSettings)).toBe(false);
      expect(existsSync(join(runDir, "candidates", "fake-a", "home", ".codex"))).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(runRoot, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 20000);

  test("executes fake candidates in parallel by default", async () => {
    const repo = createTempRepo();
    const runRoot = mkdtempSync(join(tmpdir(), "plan-bakeoff-parallel-"));
    try {
      const manifest = normalizeManifest(
        {
          schema: "plan_bakeoff_manifest_v1",
          target_repo: repo,
          plan: join(repo, "plan.md"),
          run_root: runRoot,
          candidates: [
            { id: "fake-a", harness: "fake", command_profile: "fake-barrier-success" },
            { id: "fake-b", harness: "fake", command_profile: "fake-barrier-success" },
            { id: "fake-c", harness: "fake", command_profile: "fake-barrier-success" },
          ],
        },
        join(repo, "manifest.json"),
      );

      const startedAt = Date.now();
      const runDir = await executeBakeoff(manifest);
      const elapsedMs = Date.now() - startedAt;

      expect(elapsedMs).toBeLessThan(10_000);
      const report = readFileSync(join(runDir, "final-report.md"), "utf8");
      expect(report).toContain("winner: fake-a");
      for (const id of ["fake-a", "fake-b", "fake-c"]) {
        expect(readFileSync(join(runDir, "candidates", id, "scorecard.json"), "utf8")).toContain(
          '"status": "SUCCESS"',
        );
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(runRoot, { recursive: true, force: true });
    }
  }, 30000);

  test("diagnoses post-run verification failures even when worker reports success", async () => {
    const repo = createTempRepo();
    const runRoot = mkdtempSync(join(tmpdir(), "plan-bakeoff-verification-fail-"));
    try {
      const manifest = normalizeManifest(
        {
          schema: "plan_bakeoff_manifest_v1",
          target_repo: repo,
          plan: join(repo, "plan.md"),
          run_root: runRoot,
          verification: { commands: ["false"] },
          candidates: [
            { id: "fake-a", harness: "fake", command_profile: "fake-success" },
            { id: "fake-b", harness: "fake", command_profile: "fake-success" },
          ],
        },
        join(repo, "manifest.json"),
      );
      const runDir = await executeBakeoff(manifest);
      const scorecard = readFileSync(join(runDir, "candidates", "fake-a", "scorecard.md"), "utf8");
      const report = readFileSync(join(runDir, "final-report.md"), "utf8");

      expect(scorecard).toContain("- Status: PARTIAL");
      expect(scorecard).toContain("worker reported SUCCESS but 1 post-run verification command failed");
      expect(report).toContain("- fake-a: worker reported SUCCESS but 1 post-run verification command failed");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(runRoot, { recursive: true, force: true });
    }
  }, 20000);

  test("blocks real harness execution without execute-real", async () => {
    const repo = createTempRepo();
    const runRoot = mkdtempSync(join(tmpdir(), "plan-bakeoff-real-block-"));
    try {
      const manifest = normalizeManifest(
        {
          schema: "plan_bakeoff_manifest_v1",
          target_repo: repo,
          plan: join(repo, "plan.md"),
          run_root: runRoot,
          candidates: [
            {
              id: "codex-real",
              harness: "codex-cli",
              provider_profile: "codex-router-responses",
              model: "gpt-5.5",
              command_profile: "codex-responses",
            },
            { id: "fake-a", harness: "fake" },
          ],
        },
        join(repo, "manifest.json"),
      );

      await expect(executeBakeoff(manifest)).rejects.toThrow("real harness requires --execute-real");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(runRoot, { recursive: true, force: true });
    }
  });
});
