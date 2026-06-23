import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureCodexConfigText } from "./ensure-codex-config";

const defaultStatusLine =
  'status_line = ["model-with-reasoning", "current-dir", "git-branch", "context-used", "fast-mode", "thread-title"]';

describe("codex config helper", () => {
  test("creates a default status line with git branch from an empty file", () => {
    expect(ensureCodexConfigText("")).toBe(["[features]", "multi_agent = false", "", "[tui]", defaultStatusLine, ""].join("\n"));
  });

  test("disables Codex native multi-agent support in managed config", () => {
    const output = ensureCodexConfigText(
      [
        "[features]",
        "hooks = true",
        "multi_agent = true",
        "image_generation = true",
        "",
        "[tui]",
        defaultStatusLine,
        "",
      ].join("\n"),
    );

    expect(output).toContain(["[features]", "hooks = true", "multi_agent = false", "image_generation = true"].join("\n"));
  });

  test("updates the previous managed default to include git branch in the managed position", () => {
    const output = ensureCodexConfigText(
      [
        "[tui]",
        'status_line = ["model-with-reasoning", "current-dir", "context-used", "fast-mode", "thread-title"]',
        "",
      ].join("\n"),
    );

    expect(output).toBe(["[tui]", defaultStatusLine, "", "[features]", "multi_agent = false", ""].join("\n"));
  });

  test("preserves custom status line order while appending managed items", () => {
    const output = ensureCodexConfigText(
      [
        'model = "gpt-5.2-codex"',
        "",
        "[tui]",
        'status_line = ["model", "current-dir", "custom-item"]',
        "show_tooltips = true",
        "",
      ].join("\n"),
    );

    expect(output).toContain(
      [
        "[tui]",
        'status_line = ["model", "current-dir", "custom-item", "git-branch", "context-used", "fast-mode", "thread-title"]',
        "show_tooltips = true",
      ].join("\n"),
    );
  });

  test("is idempotent", () => {
    const once = ensureCodexConfigText("[tui]\n");
    expect(ensureCodexConfigText(once)).toBe(once);
  });

  test("update task owns Codex config mutation", () => {
    const repoRoot = process.cwd();
    const updateScript = readFileSync(join(repoRoot, "scripts", "update.sh"), "utf8");
    const updateTask = readFileSync(join(repoRoot, "scripts", "tasks", "update-codex-config.sh"), "utf8");

    expect(updateScript).toContain('source "$SCRIPT_DIR/tasks/update-codex-config.sh"');
    expect(updateScript).toContain('task_run "Codex config" run_codex_config');
    expect(updateTask).toContain("run_codex_config()");
    expect(updateTask).toContain("ensure-codex-config.ts");
  });
});
