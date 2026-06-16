import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";

const repoRoot = process.cwd();

function runHelper(body: string, rows: string[] = []) {
  const rowScript = rows.map((row) => `printf '%s\\n' ${JSON.stringify(row)}`).join("\n") || ":";
  const script = `
set -euo pipefail
source scripts/lib/ensure-no-running-codex.sh
ps() {
  ${rowScript}
}
${body}
`;

  return spawnSync("bash", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

describe("Codex running-process helper", () => {
  test("warning mode is quiet when no Codex process is running", () => {
    const result = runHelper("warn_if_codex_running");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  test("warning mode reports running Codex sessions without blocking", () => {
    const result = runHelper("warn_if_codex_running", [
      "99999 pts/1 node /home/mi/bin/codex --yolo",
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Codex is already running; continuing with update.");
    expect(result.stdout).toContain("99999 pts/1 node /home/mi/bin/codex --yolo");
  });

  test("strict mode still blocks on running Codex sessions", () => {
    const result = runHelper("ensure_no_running_codex", [
      "99999 pts/1 node /home/mi/bin/codex --yolo",
    ]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Refusing to update Codex config while Codex is already running.");
  });
});
