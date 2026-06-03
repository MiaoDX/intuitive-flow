import { describe, expect, test } from "bun:test";
import { ensureAgentDeckConfigText } from "./ensure-agent-deck-config";

describe("agent-deck config helper", () => {
  test("creates the pilot config from an empty file", () => {
    expect(ensureAgentDeckConfigText("")).toBe(
      [
        'default_tool = "codex"',
        "",
        "[instances]",
        "allow_multiple = true",
        "",
        "[tmux]",
        'socket_name = "agent-deck"',
        "inject_status_line = true",
        "mouse = true",
        "",
        "[updates]",
        "auto_update = false",
        "check_enabled = false",
        "",
        "[global_search]",
        "enabled = true",
        'tier = "balanced"',
        "memory_limit_mb = 100",
        "recent_days = 90",
        "index_rate_limit = 10",
        "",
        "[mcp_pool]",
        "enabled = false",
        "",
        "[docker]",
        "default_enabled = false",
        "",
        "[worktree]",
        "default_enabled = false",
        'default_location = "subdirectory"',
        "",
      ].join("\n"),
    );
  });

  test("preserves existing settings while adding missing defaults", () => {
    const output = ensureAgentDeckConfigText(
      [
        "# existing agent-deck config",
        'default_tool = "claude"',
        "custom_top = true",
        "",
        "[tmux]",
        "mouse = true",
        'socket_name = "default"',
        "inject_status_line = false",
        "",
        "[global_search]",
        "enabled = false",
        "recent_days = 365",
        "",
        "[tools.multica]",
        'command = "multica"',
        "",
      ].join("\n"),
    );

    expect(output).toContain('default_tool = "claude"\ncustom_top = true');
    expect(output).toContain("[tmux]\n" + "mouse = true\n" + 'socket_name = "default"\n' + "inject_status_line = false");
    expect(output).toContain("[instances]\nallow_multiple = true");
    expect(output).toContain("[global_search]\n" + 'tier = "balanced"\n' + "memory_limit_mb = 100\n");
    expect(output).toContain("enabled = false");
    expect(output).toContain("recent_days = 365");
    expect(output).toContain("[tools.multica]\n" + 'command = "multica"');
    expect(output).not.toContain('default_tool = "codex"');
    expect(output).not.toContain('socket_name = "agent-deck"');
  });

  test("is idempotent", () => {
    const once = ensureAgentDeckConfigText("[tmux]\nmouse = true\n");
    expect(ensureAgentDeckConfigText(once)).toBe(once);
  });

  test("preserves user path-like config sections", () => {
    const output = ensureAgentDeckConfigText(
      [
        "[paths]",
        'available = ["/home/mi/ws/gogo/roboclaws", "/home/mi/ws/gogo/roboharness"]',
        "",
      ].join("\n"),
    );

    expect(output).toContain('available = ["/home/mi/ws/gogo/roboclaws", "/home/mi/ws/gogo/roboharness"]');
  });
});
