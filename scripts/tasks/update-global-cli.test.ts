import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("global CLI update task wiring", () => {
  test("owns global CLI install and repair phases", () => {
    const repoRoot = process.cwd();
    const updateScript = readFileSync(join(repoRoot, "scripts", "update.sh"), "utf8");
    const task = readFileSync(join(repoRoot, "scripts", "tasks", "update-global-cli.sh"), "utf8");

    expect(updateScript).toContain('source "$SCRIPT_DIR/tasks/update-global-cli.sh"');
    expect(updateScript).toContain('task_run "Global CLI tools" run_global_cli_tools --hint print_npm_failure_hint');
    expect(task).toContain("run_global_cli_tools()");
    expect(task).toContain("print_npm_failure_hint()");
    expect(task).toContain("run_global_cli_npm_install()");
  });
});
