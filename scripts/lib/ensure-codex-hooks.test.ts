import { describe, expect, test } from "bun:test";
import { ensureCodexHooksText } from "./ensure-codex-hooks";

const pluginDir = "/home/mi/.config/tmux/plugins/tmux-agent-status";

describe("codex hooks helper", () => {
  test("creates tmux-agent-status hooks from an empty file", () => {
    const parsed = JSON.parse(ensureCodexHooksText("", pluginDir));

    expect(parsed.hooks.SessionStart[0].matcher).toBe("startup|resume");
    expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe(
      `bash ${pluginDir}/hooks/codex-hook.sh SessionStart`,
    );
    expect(parsed.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
      `bash ${pluginDir}/hooks/codex-hook.sh UserPromptSubmit`,
    );
    expect(parsed.hooks.PreToolUse[0].matcher).toBe("Bash");
    expect(parsed.hooks.Stop[0].hooks[0].command).toBe(`bash ${pluginDir}/hooks/codex-hook.sh Stop`);
  });

  test("preserves existing hook owners while adding managed hooks", () => {
    const output = ensureCodexHooksText(
      JSON.stringify({
        hooks: {
          Stop: [
            {
              hooks: [{ type: "command", command: "agent-deck notify stop" }],
            },
          ],
          UserPromptSubmit: [
            {
              hooks: [{ type: "command", command: "custom prompt hook" }],
            },
          ],
        },
        custom: true,
      }),
      pluginDir,
    );

    const parsed = JSON.parse(output);
    expect(parsed.custom).toBe(true);
    expect(parsed.hooks.Stop.map((entry: { hooks: Array<{ command: string }> }) => entry.hooks[0].command)).toEqual([
      "agent-deck notify stop",
      `bash ${pluginDir}/hooks/codex-hook.sh Stop`,
    ]);
    expect(
      parsed.hooks.UserPromptSubmit.map((entry: { hooks: Array<{ command: string }> }) => entry.hooks[0].command),
    ).toEqual(["custom prompt hook", `bash ${pluginDir}/hooks/codex-hook.sh UserPromptSubmit`]);
  });

  test("is idempotent", () => {
    const once = ensureCodexHooksText("", pluginDir);
    expect(ensureCodexHooksText(once, pluginDir)).toBe(once);
  });
});
