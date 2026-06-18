import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { hasUsableTmux } from "./test-capabilities";

const repoRoot = process.cwd();
const runnerScript = join(repoRoot, "skills", "skill-runner", "scripts", "run_skill_runner.py");
const summarizerScript = join(repoRoot, "skills", "skill-runner", "scripts", "summarize_skill_runner_runs.py");
const hasTmux = hasUsableTmux();

function runPython(body: string) {
  const script = `
import importlib.util
import json
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("run_skill_runner", ${JSON.stringify(runnerScript)})
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

${body}
`;

  const result = spawnSync("python3", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: "1",
    },
  });

  if (result.status !== 0) {
    throw new Error(`python import failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }

  return JSON.parse(result.stdout);
}

describe("skill-runner script", () => {
  test("rewritten prompt includes an acceptance contract and context package", () => {
    const output = runPython(`
from pathlib import Path

prompt = module.rewrite_prompt(
    prompt="Implement docs/plans/example.md with $intuitive-flow",
    skills=["intuitive-flow"],
    cwd=Path(${JSON.stringify(repoRoot)}),
    owned_paths=[],
)
print(json.dumps({"prompt": prompt}))
`);

    expect(output.prompt).toContain("Context package:");
    expect(output.prompt).toContain("Must inspect first");
    expect(output.prompt).toContain("Acceptance contract:");
    expect(output.prompt).toContain("SUCCESS only if");
    expect(output.prompt).toContain("BLOCKED_NEEDS_DECISION if");
    expect(output.prompt).toContain("ACCEPTANCE_EVIDENCE");
  });

  test("classifies worker RESULT_STATUS from compact output", () => {
    const runDir = mkdtempSync(join(tmpdir(), "skill-runner-status-"));
    try {
      writeFileSync(
        join(runDir, "last-message.md"),
        [
          "RESULT_STATUS: BLOCKED_NEEDS_DECISION",
          "SUMMARY: missing acceptance criteria",
          "",
        ].join("\n"),
      );

      const output = runPython(`
from pathlib import Path
run_dir = Path(${JSON.stringify(runDir)})
print(json.dumps({
    "status": module.read_worker_result_status(run_dir),
    "classification": module.classify_worker_exit(run_dir, 0),
}))
`);

      expect(output.status).toBe("BLOCKED_NEEDS_DECISION");
      expect(output.classification[0]).toBe("BLOCKED");
      expect(output.classification[1]).toBe(125);
      expect(output.classification[2]).toContain("BLOCKED_NEEDS_DECISION");
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  test("dry run writes compact artifacts without starting a worker", () => {
    const runRoot = mkdtempSync(join(tmpdir(), "skill-runner-dry-"));
    try {
      const result = spawnSync(
        "python3",
        [runnerScript, "--dry-run", "--run-root", runRoot, "--cwd", repoRoot, "--", "dry run with $intuitive-flow"],
        { cwd: repoRoot, encoding: "utf8" },
      );
      expect(result.status).toBe(0);
      const runDir = result.stdout.trim().split("\n").at(-1) ?? "";
      expect(existsSync(join(runDir, "result.md"))).toBe(true);
      expect(readFileSync(join(runDir, "result.md"), "utf8")).toContain("Status: DRY_RUN");
      expect(readFileSync(join(runDir, "rewritten-prompt.md"), "utf8")).toContain("Acceptance contract:");
    } finally {
      rmSync(runRoot, { recursive: true, force: true });
    }
  });

  test("finalize-run rewrites artifacts for an existing run", () => {
    const runDir = mkdtempSync(join(tmpdir(), "skill-runner-finalize-"));
    try {
      writeFileSync(
        join(runDir, "run.json"),
        JSON.stringify({ cwd: repoRoot, session: "missing-session", skills: ["intuitive-flow"] }, null, 2) + "\n",
      );
      writeFileSync(join(runDir, "exit_code"), "0\n");
      writeFileSync(join(runDir, "last-message.md"), "RESULT_STATUS: SUCCESS\nSUMMARY: done\n");

      const result = spawnSync("python3", [runnerScript, "--finalize-run", runDir], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      expect(result.status).toBe(0);
      expect(readFileSync(join(runDir, "result.md"), "utf8")).toContain("Status: SUCCESS");
      expect(readFileSync(join(runDir, "skill-review.md"), "utf8")).toContain("Selected skills: $intuitive-flow");
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  test("writes skill review artifact from worker behavior notes", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "skill-runner-review-"));
    const tempRepo = mkdtempSync(join(tmpdir(), "skill-runner-review-clean-repo-"));
    const skillRepo = mkdtempSync(join(tmpdir(), "skill-runner-review-clean-skillrepo-"));
    try {
      spawnSync("git", ["init"], { cwd: tempRepo, encoding: "utf8" });
      spawnSync("git", ["init"], { cwd: skillRepo, encoding: "utf8" });
      writeFileSync(
        join(tempDir, "last-message.md"),
        [
          "RESULT_STATUS: SUCCESS",
          "SUMMARY: complete",
          "SKILL_BEHAVIOR_NOTES: $molmo-realworld-cleanup should explain sanitized destination policy more directly.",
          "RECOMMENDED_GOAL_REVISION: none",
          "",
        ].join("\n"),
      );

      const output = runPython(`
from pathlib import Path
run_dir = Path(${JSON.stringify(tempDir)})
module.write_skill_review(
    run_dir,
    Path(${JSON.stringify(tempRepo)}),
    Path(${JSON.stringify(skillRepo)}),
    ["molmo-realworld-cleanup", "intuitive-flow"],
    "SUCCESS",
    "worker reported success",
)
print(json.dumps({"review": (run_dir / "skill-review.md").read_text()}))
`);
      expect(output.review).toContain("Selected skills: $molmo-realworld-cleanup, $intuitive-flow");
      expect(output.review).toContain("CANDIDATE_LEARNING");
      expect(output.review).toContain("sanitized destination policy");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
      rmSync(tempRepo, { recursive: true, force: true });
      rmSync(skillRepo, { recursive: true, force: true });
    }
  });

  test("eval can split owned path changes from outside dirty work", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "skill-runner-owned-eval-"));
    const tempRepo = mkdtempSync(join(tmpdir(), "skill-runner-owned-eval-repo-"));
    const skillRepo = mkdtempSync(join(tmpdir(), "skill-runner-owned-eval-skillrepo-"));
    try {
      spawnSync("git", ["init"], { cwd: tempRepo, encoding: "utf8" });
      spawnSync("git", ["init"], { cwd: skillRepo, encoding: "utf8" });
      spawnSync("mkdir", ["-p", join(tempRepo, "src"), join(tempRepo, "docs")]);
      writeFileSync(join(tempRepo, "src", "owned.txt"), "old\n");
      writeFileSync(join(tempRepo, "docs", "outside.txt"), "old\n");
      spawnSync("git", ["add", "."], { cwd: tempRepo, encoding: "utf8" });
      spawnSync(
        "git",
        ["-c", "user.name=Skill Runner Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
        { cwd: tempRepo, encoding: "utf8" },
      );
      writeFileSync(join(tempRepo, "docs", "outside.txt"), "pre-existing\n");
      const before = spawnSync("git", ["status", "--short"], {
        cwd: tempRepo,
        encoding: "utf8",
      }).stdout.trim();
      writeFileSync(join(tempRepo, "src", "owned.txt"), "owned change\n");

      const output = runPython(`
from pathlib import Path
run_dir = Path(${JSON.stringify(tempDir)})
module.write_eval(
    run_dir,
    Path(${JSON.stringify(tempRepo)}),
    Path(${JSON.stringify(skillRepo)}),
    "SUCCESS",
    0,
    "worker reported success",
    workspace_status_before=${JSON.stringify(before)},
    owned_paths=["src"],
)
print(json.dumps({"eval": (run_dir / "eval.md").read_text()}))
`);
      expect(output.eval).toContain("Owned Path Diff");
      expect(output.eval).toContain("src/owned.txt");
      expect(output.eval).toContain("docs/outside.txt");
      expect(output.eval).toContain("Pre-run status no longer present");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
      rmSync(tempRepo, { recursive: true, force: true });
      rmSync(skillRepo, { recursive: true, force: true });
    }
  });

  test("summarizer CLI reports run status, worker result, and review recommendation", () => {
    const runRoot = mkdtempSync(join(tmpdir(), "skill-runner-summary-root-"));
    const runDir = join(runRoot, "20260608-120000-0000");
    try {
      mkdirSync(runDir);
      writeFileSync(
        join(runDir, "result.md"),
        ["# Skill Runner Result", "", "- Status: SUCCESS", "- Reason: worker finished", ""].join("\n"),
      );
      writeFileSync(join(runDir, "last-message.md"), "RESULT_STATUS: SUCCESS\nSUMMARY: worker finished\n");
      writeFileSync(
        join(runDir, "skill-review.md"),
        ["# Skill Review", "", "## Recommendation", "", "NO_SKILL_CHANGE: behavior was correct.", ""].join("\n"),
      );
      writeFileSync(
        join(runDir, "run.json"),
        JSON.stringify({ skills: ["intuitive-flow"], owned_paths: ["skills/intuitive-flow"] }, null, 2) + "\n",
      );

      const result = spawnSync("python3", [summarizerScript, "--run-root", runRoot, "--json"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: "1",
        },
      });

      if (result.status !== 0) {
        throw new Error(`summarizer failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
      }

      const rows = JSON.parse(result.stdout);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("SUCCESS");
      expect(rows[0].worker_status).toBe("SUCCESS");
      expect(rows[0].status_mismatch).toBe(false);
      expect(rows[0].skill_review).toBe("NO_SKILL_CHANGE: behavior was correct.");
    } finally {
      rmSync(runRoot, { recursive: true, force: true });
    }
  });

  test.skipIf(!hasTmux)("runs a fake non-interactive worker through tmux", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "skill-runner-exec-"));
    const fakeAgent = join(tempDir, "fake-exec-agent.sh");
    writeFileSync(
      fakeAgent,
      [
        "#!/usr/bin/env bash",
        "cat >/dev/null",
        "printf 'RESULT_STATUS: SUCCESS\\nSUMMARY: exec complete\\nCHANGED_FILES: none\\nCOMMITS: none\\nVERIFICATION: fake\\nOPEN_DECISIONS: none\\nSKILL_BEHAVIOR_NOTES: none\\nRECOMMENDED_GOAL_REVISION: none\\n'",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );

    const result = spawnSync(
      "python3",
      [
        runnerScript,
        "--agent-command",
        fakeAgent,
        "--cwd",
        repoRoot,
        "--run-root",
        tempDir,
        "--timeout-min",
        "0.05",
        "--idle-timeout-min",
        "0.05",
        "--poll-interval-sec",
        "0.1",
        "--",
        "fake exec task",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );

    const runDir = result.stdout.trim().split("\n").at(-1) ?? "";
    try {
      expect(result.status).toBe(0);
      expect(runDir).not.toBe("");
      expect(readFileSync(join(runDir, "result.md"), "utf8")).toContain("Status: SUCCESS");
      expect(readFileSync(join(runDir, "last-message.md"), "utf8")).toContain("RESULT_STATUS: SUCCESS");
      expect(readFileSync(join(runDir, "run.json"), "utf8")).toContain('"execution_mode": "exec"');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 10000);
});
