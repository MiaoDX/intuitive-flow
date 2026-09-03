import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureCodexConfigText } from "./ensure-codex-config";

const defaultStatusLine =
  'status_line = ["model-with-reasoning", "current-dir", "git-branch", "context-used", "fast-mode", "thread-title"]';

describe("codex config helper", () => {
  test("creates a default status line with git branch from an empty file", () => {
    expect(ensureCodexConfigText("")).toBe(["[features]", "multi_agent_v2 = true", "", "[tui]", defaultStatusLine, ""].join("\n"));
  });

  test("enables the current Codex native v2 surface and removes the legacy toggle", () => {
    const output = ensureCodexConfigText(
      [
        "[features]",
        "hooks = true",
        "multi_agent = false",
        "image_generation = true",
        "",
        "[tui]",
        defaultStatusLine,
        "",
      ].join("\n"),
    );

    expect(output).toContain(["[features]", "hooks = true", "multi_agent_v2 = true", "image_generation = true"].join("\n"));
    expect(output).not.toContain("multi_agent = false");
  });

  test("deduplicates legacy and v2 toggles while preserving other feature settings", () => {
    const output = ensureCodexConfigText(
      [
        "[features]",
        "hooks = true",
        "multi_agent = true",
        "multi_agent_v2 = false",
        "image_generation = true",
        "",
      ].join("\n"),
    );

    expect(output).toContain(
      ["[features]", "hooks = true", "multi_agent_v2 = true", "image_generation = true"].join("\n"),
    );
    expect(output.match(/^multi_agent_v2\s*=/gm)).toHaveLength(1);
    expect(output).not.toMatch(/^multi_agent\s*=/m);
  });

  test("removes repeated legacy toggles during migration", () => {
    const output = ensureCodexConfigText(
      ["[features]", "multi_agent = false", "hooks = true", "multi_agent = true", ""].join("\n"),
    );

    expect(output.match(/^multi_agent_v2\s*=/gm)).toHaveLength(1);
    expect(output).not.toMatch(/^multi_agent\s*=/m);
    expect(output).toContain("hooks = true");
  });

  test("updates the previous managed default to include git branch in the managed position", () => {
    const output = ensureCodexConfigText(
      [
        "[tui]",
        'status_line = ["model-with-reasoning", "current-dir", "context-used", "fast-mode", "thread-title"]',
        "",
      ].join("\n"),
    );

    expect(output).toBe(["[tui]", defaultStatusLine, "", "[features]", "multi_agent_v2 = true", ""].join("\n"));
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
