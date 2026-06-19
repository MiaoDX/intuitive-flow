import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  bakeoffPrompt,
  candidateMappedEnv,
  executeBakeoff,
  normalizeManifest,
  parseManifestText,
  proposalText,
  proposeCandidates,
  redactText,
  renderCandidateCommand,
  validateManifest,
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
    const prompt = bakeoffPrompt(
      {
        schema: "plan_bakeoff_manifest_v1",
        target_repo: repoRoot,
        plan: join(repoRoot, ".planning", "plan-bakeoff-skill.md"),
        candidates: [
          { id: "fake-a", harness: "fake" },
          { id: "fake-b", harness: "fake" },
        ],
      },
      { id: "fake-a", harness: "fake" },
    );

    expect(prompt).toContain("directly in this worktree");
    expect(prompt).toContain("Do not delegate to skill-runner, tmux, or another coding agent");
    expect(prompt).not.toContain("$intuitive-flow");
  });

  test("executes three fake candidates in independent worktrees", () => {
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
      const runDir = executeBakeoff(manifest, {
        env: {
          ...process.env,
          HOME: home,
          CODEX_HOME: join(home, ".codex"),
        },
      });

      expect(existsSync(join(runDir, "final-report.md"))).toBe(true);
      expect(readFileSync(join(runDir, "final-report.md"), "utf8")).toContain("winner: fake-a");
      for (const id of ["fake-a", "fake-b", "fake-c"]) {
        expect(existsSync(join(runDir, "candidates", id, "scorecard.json"))).toBe(true);
      }
      expect(readFileSync(join(runDir, "candidates", "fake-a", "scorecard.json"), "utf8")).toContain('"status": "SUCCESS"');
      expect(readFileSync(join(runDir, "candidates", "fake-b", "scorecard.json"), "utf8")).toContain('"status": "PARTIAL"');
      expect(git(repo, ["worktree", "list", "--porcelain"]).stdout).not.toContain(runDir);
      expect(existsSync(codexConfig)).toBe(false);
      expect(existsSync(claudeSettings)).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(runRoot, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 20000);

  test("blocks real harness execution without execute-real", () => {
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

      expect(() => executeBakeoff(manifest)).toThrow("real harness requires --execute-real");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(runRoot, { recursive: true, force: true });
    }
  });
});
