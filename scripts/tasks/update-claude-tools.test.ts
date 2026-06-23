import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Claude update task wiring", () => {
  test("owns Claude plugin and MCP fetch phases", () => {
    const repoRoot = process.cwd();
    const updateScript = readFileSync(join(repoRoot, "scripts", "update.sh"), "utf8");
    const task = readFileSync(join(repoRoot, "scripts", "tasks", "update-claude-tools.sh"), "utf8");
    const globalCliTask = readFileSync(join(repoRoot, "scripts", "tasks", "update-cli.sh"), "utf8");

    expect(updateScript).toContain('source "$SCRIPT_DIR/tasks/update-claude-tools.sh"');
    expect(updateScript).toContain('task_run "MCP: fetch" run_mcp_fetch');
    expect(updateScript).toContain('task_run "Claude plugins" run_claude_plugins');
    expect(task).toContain("run_mcp_fetch()");
    expect(task).toContain("run_claude_plugins()");
    expect(task).toContain("claude-fetch-setup");
    expect(task).toContain("claude plugin install");
    expect(globalCliTask).not.toContain("run_mcp_fetch()");
    expect(globalCliTask).not.toContain("run_claude_plugins()");
  });
});
