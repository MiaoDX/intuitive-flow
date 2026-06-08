import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { hasUsableTmux } from "./test-capabilities";

const withTmuxStub = (body: string, callback: (env: NodeJS.ProcessEnv, logPath: string) => void) => {
  const tempDir = mkdtempSync(join(tmpdir(), "tmux-capability-"));
  const binDir = join(tempDir, "bin");
  const logPath = join(tempDir, "tmux.log");
  try {
    mkdirSync(binDir, { recursive: true });
    const tmuxPath = join(binDir, "tmux");
    writeFileSync(
      tmuxPath,
      [
        "#!/usr/bin/env bash",
        `printf '%s\\n' "$*" >> ${JSON.stringify(logPath)}`,
        body,
        "",
      ].join("\n"),
    );
    chmodSync(tmuxPath, 0o755);

    callback(
      {
        ...process.env,
        PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}`,
      },
      logPath,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

describe("test capability probes", () => {
  test("requires tmux sessions to be creatable, not just an installed binary", () => {
    withTmuxStub(
      `
if [ "$1" = "-V" ]; then exit 0; fi
if [ "$1" = "new-session" ]; then exit 1; fi
exit 1
`,
      (env, logPath) => {
        expect(hasUsableTmux(env)).toBe(false);
        expect(readFileSync(logPath, "utf8")).toContain("new-session");
      },
    );
  });

  test("cleans up the tmux probe session after a successful probe", () => {
    withTmuxStub(
      `
if [ "$1" = "-V" ]; then exit 0; fi
if [ "$1" = "new-session" ]; then exit 0; fi
if [ "$1" = "kill-session" ]; then exit 0; fi
exit 1
`,
      (env, logPath) => {
        expect(hasUsableTmux(env)).toBe(true);
        expect(readFileSync(logPath, "utf8")).toContain("kill-session");
      },
    );
  });
});
