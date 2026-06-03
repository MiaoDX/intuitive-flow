import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = process.cwd();
const runnerScript = join(repoRoot, "skills", "skill-runner", "scripts", "run_skill_runner.py");
const hasTmux = spawnSync("tmux", ["-V"], { encoding: "utf8" }).status === 0;

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
  test("detects Codex bwrap sandbox failures reported in last-message", () => {
    const runDir = mkdtempSync(join(tmpdir(), "skill-runner-bwrap-"));
    try {
      writeFileSync(
        join(runDir, "last-message.md"),
        [
          "RESULT_STATUS: FAILED",
          "SUMMARY: bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted",
          "",
        ].join("\n"),
      );

      const output = runPython(`
from pathlib import Path

run_dir = Path(${JSON.stringify(runDir)})
print(json.dumps({
    "detected": module.detect_sandbox_loopback_failure(run_dir),
    "classification": module.classify_worker_exit(run_dir, 0),
    "preflight": module.classify_sandbox_preflight(run_dir, exit_code=1),
}))
`);
      expect(output.detected).toBe(true);
      expect(output.classification[0]).toBe("BLOCKED");
      expect(output.classification[1]).toBe(125);
      expect(output.classification[2]).toContain("sandbox-loopback-denied");
      expect(output.preflight.status).toBe("loopback_unavailable");
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  test("cache key changes when host capability inputs change", () => {
    const output = runPython(`
key1 = module.build_sandbox_cache_key(
    codex_path="/bin/codex",
    codex_version="codex-cli 1",
    bwrap_path="/usr/bin/bwrap",
    bwrap_version="bubblewrap 1",
    kernel="Linux test 1",
    sysctls={"kernel.unprivileged_userns_clone": "1"},
)
key2 = module.build_sandbox_cache_key(
    codex_path="/bin/codex",
    codex_version="codex-cli 1",
    bwrap_path="/usr/bin/bwrap",
    bwrap_version="bubblewrap 1",
    kernel="Linux test 1",
    sysctls={"kernel.unprivileged_userns_clone": "0"},
)
print(json.dumps({
    "changed": key1 != key2,
    "stable": key1 == module.build_sandbox_cache_key(
        codex_path="/bin/codex",
        codex_version="codex-cli 1",
        bwrap_path="/usr/bin/bwrap",
        bwrap_version="bubblewrap 1",
        kernel="Linux test 1",
        sysctls={"kernel.unprivileged_userns_clone": "1"},
    ),
}))
`);

    expect(output.changed).toBe(true);
    expect(output.stable).toBe(true);
  });

  test("cached loopback failure selects bypass unless sandbox is required", () => {
    const output = runPython(`
from pathlib import Path

key = module.build_sandbox_cache_key(
    codex_path="/bin/codex",
    codex_version="codex-cli 1",
    bwrap_path="/usr/bin/bwrap",
    bwrap_version="bubblewrap 1",
    kernel="Linux test 1",
    sysctls={"kernel.unprivileged_userns_clone": "1"},
)
cache = {
    "schema_version": module.SANDBOX_CACHE_SCHEMA_VERSION,
    "status": "loopback_unavailable",
    "reason": "bwrap loopback denied",
    "key": key,
    "updated_at": "2026-05-18T00:00:00+00:00",
}
normal = module.sandbox_decision_from_cache(
    cache,
    key,
    require_sandbox=False,
    cache_path=Path("/tmp/sandbox-capability.json"),
)
strict = module.sandbox_decision_from_cache(
    cache,
    key,
    require_sandbox=True,
    cache_path=Path("/tmp/sandbox-capability.json"),
)
print(json.dumps({
    "normal_dangerous": normal["dangerous"],
    "normal_blocked": normal["blocked"],
    "normal_mode": normal["mode"],
    "strict_dangerous": strict["dangerous"],
    "strict_blocked": strict["blocked"],
    "strict_mode": strict["mode"],
}))
`);

    expect(output.normal_dangerous).toBe(true);
    expect(output.normal_blocked).toBe(false);
    expect(output.normal_mode).toBe("bypass");
    expect(output.strict_dangerous).toBe(false);
    expect(output.strict_blocked).toBe(true);
    expect(output.strict_mode).toBe("blocked");
  });

  test("detects interactive approval prompts in terminal logs when requested", () => {
    const runDir = mkdtempSync(join(tmpdir(), "skill-runner-terminal-risk-"));
    try {
      writeFileSync(
        join(runDir, "terminal.log"),
        [
          "[ ! ] Action Required",
          "Would you like to run the following command?",
          "",
        ].join("\n"),
      );

      const output = runPython(`
from pathlib import Path

run_dir = Path(${JSON.stringify(runDir)})
print(json.dumps({
    "normal": module.detect_risk(run_dir),
    "interactive": module.detect_risk(run_dir, include_terminal=True),
}))
`);
      expect(output.normal).toBe(null);
      expect(output.interactive).toBe("interactive-approval");
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  test("detects RESULT_STATUS rendered with terminal UI prefixes", () => {
    const runDir = mkdtempSync(join(tmpdir(), "skill-runner-terminal-result-"));
    try {
      writeFileSync(
        join(runDir, "terminal.log"),
        [
          "────────────────",
          "• RESULT_STATUS: SUCCESS",
          "  SUMMARY: done",
          "",
        ].join("\n"),
      );

      const output = runPython(`
from pathlib import Path

run_dir = Path(${JSON.stringify(runDir)})
module.materialize_interactive_last_message(run_dir)
print(json.dumps({
    "status": module.read_worker_result_status(run_dir),
    "last_message": (run_dir / "last-message.md").read_text(),
}))
`);
      expect(output.status).toBe("SUCCESS");
      expect(output.last_message).toContain("RESULT_STATUS: SUCCESS");
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  function runFakeInteractiveRunner(
    extraArgs: string[] = [],
    options: { fakeAgentBody?: string; timeoutMin?: string; idleTimeoutMin?: string } = {},
  ) {
    const tempDir = mkdtempSync(join(tmpdir(), "skill-runner-interactive-"));
    const commandLog = join(tempDir, "commands.log");
    const fakeAgent = join(tempDir, "fake-agent.sh");
    const defaultBody = [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf '\\n› '",
      "while IFS= read -r line; do",
      `  printf '%s\\n' "$line" >> ${JSON.stringify(commandLog)}`,
      "  case \"$line\" in",
      "    /goal\\ *) printf '\\nGoal active\\n› ' ;;",
      "    /goal\\ clear) printf '\\nGoal cleared\\n› ' ;;",
      "    /clear) printf '\\nCleared\\n› ' ;;",
      "    *) printf '\\nRESULT_STATUS: SUCCESS\\nSUMMARY: fake interactive worker complete\\nCHANGED_FILES: none\\nCOMMITS: none\\nVERIFICATION: fake agent\\nOPEN_DECISIONS: none\\nSKILL_BEHAVIOR_NOTES: none\\nRECOMMENDED_GOAL_REVISION: none\\n› ' ;;",
      "  esac",
      "done",
      "",
    ].join("\n");
    writeFileSync(fakeAgent, options.fakeAgentBody ?? defaultBody, { mode: 0o755 });

    const result = spawnSync(
      "python3",
      [
        runnerScript,
        "--interactive",
        "--dangerous",
        "--no-auto-stop",
        "--agent-command",
        fakeAgent,
        "--cwd",
        repoRoot,
        "--run-root",
        tempDir,
        "--timeout-min",
        options.timeoutMin ?? "0.05",
        "--idle-timeout-min",
        options.idleTimeoutMin ?? "0.05",
        "--interactive-send-settle-sec",
        "0",
        "--interactive-ready-timeout-sec",
        "2",
        "--poll-interval-sec",
        "0.1",
        "--goal",
        "stable interactive goal",
        ...extraArgs,
        "--",
        "fake interactive task",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: "1",
        },
      },
    );

    const runDir = result.stdout.trim().split("\n").at(-1) ?? "";
    return { commandLog, result, runDir, tempDir };
  }

  test.skipIf(!hasTmux)("interactive mode closes tmux without clearing goal by default", () => {
    const run = runFakeInteractiveRunner();
    try {
      expect(run.result.status).toBe(0);
      expect(existsSync(join(run.runDir, "result.md"))).toBe(true);
      expect(readFileSync(join(run.runDir, "result.md"), "utf8")).toContain("Status: SUCCESS");
      expect(readFileSync(join(run.runDir, "tmux-inputs.jsonl"), "utf8")).toContain('"label": "goal"');
      const commands = readFileSync(run.commandLog, "utf8").trim().split("\n");
      expect(commands[0]).toBe("/goal stable interactive goal");
      expect(commands[1]).toContain("rewritten-prompt.md");
      expect(commands[1]).toContain("RESULT_STATUS");
      expect(commands).not.toContain("/goal clear");
      expect(commands).not.toContain("/clear");
    } finally {
      rmSync(run.tempDir, { recursive: true, force: true });
    }
  });

  test.skipIf(!hasTmux)("interactive mode can opt into goal and context clearing", () => {
    const run = runFakeInteractiveRunner(["--clear-goal-on-exit", "--clear-context-on-exit"]);
    try {
      expect(run.result.status).toBe(0);
      const commands = readFileSync(run.commandLog, "utf8").trim().split("\n");
      expect(commands.slice(-2)).toEqual(["/goal clear", "/clear"]);
    } finally {
      rmSync(run.tempDir, { recursive: true, force: true });
    }
  });

  test("claude interactive command auto-adds run_dir, $CLAUDE_JOB_DIR, $HOME/.claude/jobs", () => {
    const runDir = mkdtempSync(join(tmpdir(), "skill-runner-add-dir-"));
    const jobDir = mkdtempSync(join(tmpdir(), "skill-runner-jobdir-"));
    try {
      const output = runPython(`
from pathlib import Path
import argparse, os

os.environ["CLAUDE_JOB_DIR"] = ${JSON.stringify(jobDir)}
ns = argparse.Namespace(
    agent="claude",
    agent_command=None,
)
command = module.interactive_agent_command(
    args=ns,
    cwd=Path("/tmp"),
    dangerous=False,
    run_dir=Path(${JSON.stringify(runDir)}),
)
print(json.dumps({"command": command}))
`);
      const cmd = output.command as string[];
      expect(cmd[0]).toBe("claude");
      // bypassPermissions mode so the supervised tmux worker does not stall
      // on file/write/bash prompts during an unattended detached run.
      expect(cmd).toContain("--permission-mode");
      expect(cmd[cmd.indexOf("--permission-mode") + 1]).toBe("bypassPermissions");
      // --add-dir for each pre-authorized path.
      const addDirPairs: string[] = [];
      for (let i = 0; i < cmd.length - 1; i++) {
        if (cmd[i] === "--add-dir") addDirPairs.push(cmd[i + 1]);
      }
      // Normalize paths via realpath because macOS /var <-> /private/var symlinks.
      const expected = new Set(
        [runDir, jobDir, join(process.env.HOME ?? "", ".claude", "jobs")].map((p) =>
          existsSync(p) ? realpathLike(p) : p,
        ),
      );
      const seen = new Set(addDirPairs.map((p) => realpathLike(p)));
      for (const want of expected) {
        expect(seen.has(want)).toBe(true);
      }
    } finally {
      rmSync(runDir, { recursive: true, force: true });
      rmSync(jobDir, { recursive: true, force: true });
    }
  });

  test("claude interactive command with --dangerous skips --add-dir (uses skip-permissions instead)", () => {
    const runDir = mkdtempSync(join(tmpdir(), "skill-runner-add-dir-dangerous-"));
    try {
      const output = runPython(`
from pathlib import Path
import argparse

ns = argparse.Namespace(agent="claude", agent_command=None)
command = module.interactive_agent_command(
    args=ns,
    cwd=Path("/tmp"),
    dangerous=True,
    run_dir=Path(${JSON.stringify(runDir)}),
)
print(json.dumps({"command": command}))
`);
      const cmd = output.command as string[];
      expect(cmd).toContain("--dangerously-skip-permissions");
      expect(cmd).not.toContain("--add-dir");
      // In dangerous mode, we rely on skip-permissions; no need for acceptEdits.
      expect(cmd).not.toContain("--permission-mode");
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  test("RESULT_STATUS detection ignores ANSI cursor-move escapes in terminal.log", () => {
    const runDir = mkdtempSync(join(tmpdir(), "skill-runner-ansi-"));
    try {
      // Recreate the real-world pattern we observed:
      //   `[2G[38;5;231m[2m 79[6G[22mRESULT_STATUS:[21GSUCCESS[39m`
      writeFileSync(
        join(runDir, "terminal.log"),
        "[2G[38;5;231m[2m 79[6G[22mRESULT_STATUS:[21GSUCCESS[39m\n",
      );
      const output = runPython(`
from pathlib import Path
print(json.dumps({"status": module.read_worker_result_status(Path(${JSON.stringify(runDir)}))}))
`);
      expect(output.status).toBe("SUCCESS");
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  test("has_interactive_prompt accepts ANSI-noisy claude-style prompts", () => {
    const output = runPython(`
ansi_prompt = "\\x1b[2m\\x1b[38;5;246m❯ \\x1b[39m\\x1b[22m"
plain_prompt = "\\n  › \\n"
no_prompt = "Working...\\nStill thinking...\\n"
codex_loading = "model:       loading   /model to change\\n› Find and fix a bug"
codex_queued = "• Queued follow-up inputs\\n› Find and fix a bug"
print(json.dumps({
    "ansi": module.has_interactive_prompt(ansi_prompt),
    "plain": module.has_interactive_prompt(plain_prompt),
    "none": module.has_interactive_prompt(no_prompt),
    "loading_prompt": module.has_interactive_prompt(codex_loading),
    "loading_busy": module.is_interactive_startup_busy(codex_loading),
    "queued_busy": module.is_interactive_startup_busy(codex_queued),
}))
`);
    expect(output.ansi).toBe(true);
    expect(output.plain).toBe(true);
    expect(output.none).toBe(false);
    expect(output.loading_prompt).toBe(true);
    expect(output.loading_busy).toBe(true);
    expect(output.queued_busy).toBe(true);
  });

  test("materializes interactive last-message even when RESULT_STATUS is not near log tail", () => {
    const runDir = mkdtempSync(join(tmpdir(), "skill-runner-long-terminal-"));
    try {
      writeFileSync(
        join(runDir, "terminal.log"),
        [
          "RESULT_STATUS: SUCCESS",
          "SUMMARY: complete",
          "x".repeat(30000),
        ].join("\n"),
      );
      const output = runPython(`
from pathlib import Path
run_dir = Path(${JSON.stringify(runDir)})
module.materialize_interactive_last_message(run_dir)
print(json.dumps({
    "exists": (run_dir / "last-message.md").exists(),
    "status": module.read_worker_result_status(run_dir),
}))
`);
      expect(output.exists).toBe(true);
      expect(output.status).toBe("SUCCESS");
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
          "CHANGED_FILES: none",
          "COMMITS: none",
          "VERIFICATION: fake",
          "OPEN_DECISIONS: none",
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
      expect(output.review).toContain("User Decision");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
      rmSync(tempRepo, { recursive: true, force: true });
      rmSync(skillRepo, { recursive: true, force: true });
    }
  });

  test("skill review reports workspace-local skill diffs separately", () => {
    const tempRepo = mkdtempSync(join(tmpdir(), "skill-runner-review-repo-"));
    const skillRepo = mkdtempSync(join(tmpdir(), "skill-runner-review-skillrepo-"));
    try {
      spawnSync("git", ["init"], { cwd: tempRepo, encoding: "utf8" });
      spawnSync("git", ["init"], { cwd: skillRepo, encoding: "utf8" });
      writeFileSync(join(tempRepo, "README.md"), "repo\n");
      writeFileSync(join(skillRepo, "README.md"), "skills\n");
      spawnSync("mkdir", ["-p", join(tempRepo, "skills", "local-skill")]);
      spawnSync("mkdir", ["-p", join(skillRepo, "skills", "shared-skill")]);
      writeFileSync(join(tempRepo, "skills", "local-skill", "SKILL.md"), "local\n");
      writeFileSync(join(skillRepo, "skills", "shared-skill", "SKILL.md"), "shared\n");
      spawnSync("git", ["add", "."], { cwd: tempRepo, encoding: "utf8" });
      spawnSync(
        "git",
        ["-c", "user.name=Skill Runner Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
        { cwd: tempRepo, encoding: "utf8" },
      );
      spawnSync("git", ["add", "."], { cwd: skillRepo, encoding: "utf8" });
      spawnSync(
        "git",
        ["-c", "user.name=Skill Runner Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
        { cwd: skillRepo, encoding: "utf8" },
      );

      writeFileSync(join(tempRepo, "skills", "local-skill", "SKILL.md"), "local changed\n");
      writeFileSync(join(skillRepo, "skills", "shared-skill", "SKILL.md"), "shared changed\n");

      const runDir = mkdtempSync(join(tmpdir(), "skill-runner-review-out-"));
      const output = runPython(`
from pathlib import Path
run_dir = Path(${JSON.stringify(runDir)})
module.write_skill_review(
    run_dir,
    Path(${JSON.stringify(tempRepo)}),
    Path(${JSON.stringify(skillRepo)}),
    ["local-skill"],
    "SUCCESS",
    "worker reported success",
)
print(json.dumps({"review": (run_dir / "skill-review.md").read_text()}))
`);
      expect(output.review).toContain("Workspace Skill Diff");
      expect(output.review).toContain("skills/local-skill/SKILL.md");
      expect(output.review).toContain("Custom Skill Source Diff");
      expect(output.review).toContain("skills/shared-skill/SKILL.md");
      expect(output.review).toContain("REVIEW_REQUIRED");
      rmSync(runDir, { recursive: true, force: true });
    } finally {
      rmSync(tempRepo, { recursive: true, force: true });
      rmSync(skillRepo, { recursive: true, force: true });
    }
  });

  test.skipIf(!hasTmux)("interactive idle-timeout fires stop_session when RESULT_STATUS never arrives", () => {
    const stuckAgent = [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf '\\n› '",
      "while IFS= read -r line; do",
      "  printf '%s\\n' \"$line\" >> /dev/null",
      "  printf '\\nAck; still working\\n› '",
      "done",
      // Block on stdin once it closes so the worker stays alive past idle timer.
      "sleep 60",
      "",
    ].join("\n");
    const run = runFakeInteractiveRunner([], {
      fakeAgentBody: stuckAgent,
      idleTimeoutMin: "0.05", // ~3 seconds
      timeoutMin: "5",
    });
    try {
      // Runner should exit non-zero with stopped_reason: idle-timeout.
      expect(run.result.status).not.toBe(0);
      const stoppedReasonPath = join(run.runDir, "stopped_reason");
      expect(existsSync(stoppedReasonPath)).toBe(true);
      expect(readFileSync(stoppedReasonPath, "utf8")).toContain("idle-timeout");
      // result.md must reflect FAILED, not the initial SUCCESS template.
      const resultText = readFileSync(join(run.runDir, "result.md"), "utf8");
      expect(resultText).toContain("Status: FAILED");
      expect(resultText.toLowerCase()).toContain("idle timeout");
    } finally {
      rmSync(run.tempDir, { recursive: true, force: true });
    }
  }, 10000);

  test.skipIf(!hasTmux)("interactive startup exit writes blocked artifacts instead of traceback", () => {
    const run = runFakeInteractiveRunner([], {
      fakeAgentBody: "#!/usr/bin/env bash\nexit 0\n",
      timeoutMin: "0.05",
      idleTimeoutMin: "0.05",
    });
    try {
      expect(run.result.status).toBe(125);
      const resultText = readFileSync(join(run.runDir, "result.md"), "utf8");
      const evalText = readFileSync(join(run.runDir, "eval.md"), "utf8");
      expect(resultText).toContain("Status: BLOCKED");
      expect(resultText).toContain("interactive prompt injection failed");
      expect(evalText).toContain("Exit code: 125");
      expect(run.result.stderr).not.toContain("Traceback");
    } finally {
      rmSync(run.tempDir, { recursive: true, force: true });
    }
  });
});

function realpathLike(p: string): string {
  // Avoid pulling in fs.realpathSync to keep test deps minimal; this collapses
  // the common macOS /var -> /private/var symlink that breaks naive path equality.
  if (p.startsWith("/var/")) return "/private" + p;
  return p;
}
