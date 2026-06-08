import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { hasUsableTmux } from "../lib/test-capabilities";

const repoRoot = process.cwd();
const hasTmux = hasUsableTmux();

function runWatchdogScript(script: string, args: string[] = [], env: NodeJS.ProcessEnv = {}) {
  return spawnSync("bash", ["-c", script, "bash", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      WATCHDOG_TMUX_TARGETS: "",
      WATCHDOG_TMUX_SOCKET_NAME: "",
      WATCHDOG_TMUX_SOCKET_PATH: "",
      ...env,
    },
  });
}

function runWatchdogCheck(functionName: string, output: string) {
  const script = `
source scripts/dev/tmux-watchdog.sh
if ${functionName} "$1"; then
  printf 'yes'
else
  printf 'no'
fi
`;

  const result = runWatchdogScript(script, [output], {
    WATCHDOG_STUCK_WINDOW_LINES: "12",
  });

  if (result.status !== 0) {
    throw new Error(`watchdog check failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }

  return result.stdout;
}

describe("tmux watchdog stuck detection", () => {
  test("ignores completed-agent prose that mentions provider API errors", () => {
    const output = [
      "• Review complete",
      "  - Kimi RAW_FPV was retried twice. Both runs reached MCP tools, then failed from the provider with API Error: The server had an error while processing your request.",
      "",
      "›",
    ].join("\n");

    expect(runWatchdogCheck("has_stuck_pattern", output)).toBe("no");
  });

  test("ignores stale rate-limit text outside the actionable prompt window", () => {
    const filler = Array.from({ length: 16 }, (_, index) => `completed step ${index + 1}`);
    const output = ["rate limit reached; resets at 18:00", ...filler, "", "›"].join("\n");

    expect(runWatchdogCheck("has_stuck_pattern", output)).toBe("no");
  });

  test("detects recent rate-limit text near the ready prompt", () => {
    const output = ["working", "rate limit reached; resets at 18:00", "", "›"].join("\n");

    expect(runWatchdogCheck("has_stuck_pattern", output)).toBe("yes");
  });
});

describe("tmux watchdog tmux target selection", () => {
  test("uses the default and Agent Deck tmux servers without arguments", () => {
    const result = runWatchdogScript(`
source scripts/dev/tmux-watchdog.sh
parse_args
tmux_targets_display
`);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("tmux, tmux -L agent-deck");
  });

  test("supports the agent-deck monitor shorthand", () => {
    const result = runWatchdogScript(`
source scripts/dev/tmux-watchdog.sh
parse_args monitor agent-deck
tmux_targets_display
`);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("tmux -L agent-deck");
  });

  test("supports tmux socket name from the environment", () => {
    const result = runWatchdogScript(
      `
source scripts/dev/tmux-watchdog.sh
parse_args
tmux_targets_display
`,
      [],
      { WATCHDOG_TMUX_SOCKET_NAME: "agent-deck" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("tmux -L agent-deck");
  });

  test("lets the default target override a socket environment variable", () => {
    const result = runWatchdogScript(
      `
source scripts/dev/tmux-watchdog.sh
parse_args default
tmux_targets_display
`,
      [],
      { WATCHDOG_TMUX_SOCKET_NAME: "agent-deck" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("tmux");
  });

  test("rejects conflicting socket name and path settings", () => {
    const result = runWatchdogScript(
      `
source scripts/dev/tmux-watchdog.sh
parse_args
`,
      [],
      {
        WATCHDOG_TMUX_SOCKET_NAME: "agent-deck",
        WATCHDOG_TMUX_SOCKET_PATH: "/tmp/tmux-agent-deck.sock",
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("set only one of WATCHDOG_TMUX_SOCKET_NAME or WATCHDOG_TMUX_SOCKET_PATH");
  });
});

describe("tmux watchdog prompt injection", () => {
  test.skipIf(!hasTmux)("submits slash commands to an interactive tmux pane", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "tmux-watchdog-send-"));
    const session = `tmux-watchdog-send-${process.pid}-${Date.now()}`;
    const commandLog = join(tempDir, "commands.log");
    try {
      const agentScript = [
        "printf '› '",
        "while IFS= read -r line; do",
        `  printf '%s\\n' \"$line\" >> ${JSON.stringify(commandLog)}`,
        "  printf '\\nACK:%s\\n› ' \"$line\"",
        "done",
      ].join("\n");
      const started = spawnSync("tmux", ["new-session", "-d", "-s", session, "bash", "-lc", agentScript], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      expect(started.status).toBe(0);

      const result = runWatchdogScript(
        `
source scripts/dev/tmux-watchdog.sh
parse_args default
PROMPT='/goal stable tmux injection proof'
send_prompt "$1" true
PROMPT='/goal clear'
send_prompt "$1" true
PROMPT='/clear'
send_prompt "$1" true
for _ in 1 2 3 4 5; do
  [ "$(wc -l < "$2" 2>/dev/null || printf 0)" -ge 3 ] && break
  sleep 0.1
done
`,
        [session, commandLog],
        {
          WATCHDOG_SEND_SETTLE_SECONDS: "0",
        },
      );

      expect(result.status).toBe(0);
      expect(readFileSync(commandLog, "utf8").trim().split("\n")).toEqual([
        "/goal stable tmux injection proof",
        "/goal clear",
        "/clear",
      ]);
    } finally {
      spawnSync("tmux", ["kill-session", "-t", session], { encoding: "utf8" });
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
