import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "bun:test";
import { classifyStopGateCommandResult } from "./intuitive-flow-stop-gate";
import { hasUsableTmux } from "./test-capabilities";

const repoRoot = process.cwd();
const hasTmux = hasUsableTmux();

describe("intuitive-flow deterministic stop gates", () => {
  test("stops on a human-owned blocker", () => {
    const decision = classifyStopGateCommandResult({
      exitCode: 1,
      stdout: JSON.stringify({
        ok: false,
        status: "blocked",
        next_action_owner: "human",
        required_input: "5 passing human attempt records",
      }),
    });

    expect(decision.kind).toBe("stop_or_mark_blocked");
    expect(decision.nextActionOwner).toBe("human");
  });

  test("stops on common blocked verifier output that names external evidence", () => {
    const decision = classifyStopGateCommandResult({
      exitCode: 1,
      stdout: [
        "validate:human failed",
        JSON.stringify({
          ok: false,
          status: "blocked",
          errors: ["missing real user testing evidence"],
        }),
      ].join("\n"),
    });

    expect(decision.kind).toBe("stop_or_mark_blocked");
  });

  test("continues or repairs an agent-fixable failure", () => {
    const decision = classifyStopGateCommandResult({
      exitCode: 1,
      stdout: JSON.stringify({
        ok: false,
        status: "failed",
        errors: ["TypeScript compile failed: missing import"],
      }),
    });

    expect(decision.kind).toBe("continue_or_repair");
  });

  test("routes successful gates through completion audit", () => {
    const decision = classifyStopGateCommandResult({
      exitCode: 0,
      stdout: JSON.stringify({ ok: true, status: "complete" }),
    });

    expect(decision.kind).toBe("completion_audit");
  });

  test.skipIf(!hasTmux)("tmux throwaway worker stops after the first external-input gate result", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "iflow-stop-gate-"));
    const sessionName = `iflow-stop-gate-${process.pid}-${Date.now()}`;
    const helperUrl = pathToFileURL(join(repoRoot, "scripts", "lib", "intuitive-flow-stop-gate.ts")).href;
    const validatorPath = join(tempDir, "validate-human.mjs");
    const runnerPath = join(tempDir, "runner.ts");
    const runScriptPath = join(tempDir, "run.sh");
    const attemptsPath = join(tempDir, "attempts.log");
    const logPath = join(tempDir, "runner.log");
    const exitPath = join(tempDir, "exit-code");

    try {
      writeFileSync(
        validatorPath,
        [
          "import { appendFileSync } from 'node:fs';",
          `appendFileSync(${JSON.stringify(attemptsPath)}, 'status\\n');`,
          "console.log(JSON.stringify({",
          "  ok: false,",
          "  status: 'blocked',",
          "  next_action_owner: 'human',",
          "  required_input: '5 passing human attempt records'",
          "}));",
          "process.exit(1);",
          "",
        ].join("\n"),
      );
      writeFileSync(
        runnerPath,
        [
          "import { spawnSync } from 'node:child_process';",
          `import { classifyStopGateCommandResult } from ${JSON.stringify(helperUrl)};`,
          "",
          "for (let attempt = 1; attempt <= 5; attempt++) {",
          `  const gate = spawnSync('bun', [${JSON.stringify(validatorPath)}], { encoding: 'utf8' });`,
          "  const decision = classifyStopGateCommandResult({",
          "    exitCode: gate.status,",
          "    stdout: gate.stdout,",
          "    stderr: gate.stderr,",
          "    signal: gate.signal,",
          "  });",
          "  console.log(`attempt=${attempt} decision=${decision.kind}`);",
          "  if (decision.kind === 'stop_or_mark_blocked') process.exit(0);",
          "}",
          "process.exit(64);",
          "",
        ].join("\n"),
      );
      writeFileSync(
        runScriptPath,
        [
          "#!/usr/bin/env bash",
          "set -u",
          `cd ${shellQuote(repoRoot)}`,
          `bun ${shellQuote(runnerPath)} > ${shellQuote(logPath)} 2>&1`,
          "code=$?",
          `printf '%s\\n' "$code" > ${shellQuote(exitPath)}`,
          "exit \"$code\"",
          "",
        ].join("\n"),
        { mode: 0o755 },
      );

      const tmuxResult = spawnSync("tmux", ["new-session", "-d", "-s", sessionName, runScriptPath], {
        encoding: "utf8",
      });
      expect(tmuxResult.status).toBe(0);

      await waitForFile(exitPath, 5000);
      expect(readFileSync(exitPath, "utf8").trim()).toBe("0");
      expect(readFileSync(logPath, "utf8")).toContain("attempt=1 decision=stop_or_mark_blocked");
      expect(readFileSync(attemptsPath, "utf8").trim().split("\n")).toEqual(["status"]);
    } finally {
      spawnSync("tmux", ["kill-session", "-t", sessionName], { encoding: "utf8" });
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

async function waitForFile(path: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(path)) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${path}`);
    await Bun.sleep(50);
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
