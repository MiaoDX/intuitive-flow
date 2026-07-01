import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  parseArgs,
  readState,
  validateConfig,
} from "./paseo-keep-going";
import {
  findCapacityError,
  parseCreatedAgeMs,
  planKeepGoingActions,
  planOrphanCodexCleanup,
  type CodexAppServerProcess,
  type KeepGoingState,
  type PaseoAgent,
} from "./paseo-keep-going-plan";

const baseConfig = {
  statuses: new Set(["running", "error"]),
  patterns: [/\[System Error\]\s*Selected model is at capacity\. Please try a different model\./i],
  cooldownMs: 600_000,
  includeSelf: false,
  selfAgentId: undefined,
};

const keepGoingPrompt =
  "The previous turn appears to have been interrupted by a transient API error. Please continue from your last valid state and keep going. Do not restart from scratch.";

describe("paseo keep-going monitor", () => {
  test("matches the model-capacity system error from recent Paseo logs", () => {
    const match = findCapacityError(`
      [User] please continue
      [System Error] Selected model is at capacity. Please try a different model.
    `);

    expect(match?.line).toBe("[System Error] Selected model is at capacity. Please try a different model.");
  });

  test("matches model-capacity errors that are appended to a progress line", () => {
    const match = findCapacityError(
      "I found the signature and I am starting it now.[System Error] Selected model is at capacity. Please try a different model.",
    );

    expect(match?.line).toContain("[System Error] Selected model is at capacity");
  });

  test("matches stream-disconnected API errors from dropped Paseo sessions", () => {
    const urlError = findCapacityError(
      "metadata refresh.[System Error] stream disconnected before completion: error sending request for url (https://api-router.evad.mioffice.cn/v1/responses)",
    );
    const timeoutError = findCapacityError(
      "editing files.[System Error] stream disconnected before completion: Transport error: timeout",
    );

    expect(urlError?.line).toContain("stream disconnected before completion");
    expect(timeoutError?.line).toContain("Transport error: timeout");
  });

  test("matches stream-closed response completion errors from dropped Paseo sessions", () => {
    const match = findCapacityError(
      "Architecture claim recorded.[System Error] stream disconnected before completion: stream closed before response.completed",
    );

    expect(match?.line).toContain("stream closed before response.completed");
  });

  test("matches account concurrency stream-disconnected errors", () => {
    const match = findCapacityError(
      "[System Error] stream disconnected before completion: Concurrency limit exceeded for account, please retry later",
    );

    expect(match?.line).toContain("Concurrency limit exceeded for account");
  });

  test("matches upstream request failed stream-disconnected errors", () => {
    const match = findCapacityError(
      "[System Error] stream disconnected before completion: Upstream request failed",
    );

    expect(match?.line).toContain("Upstream request failed");
  });

  test("plans a send only for monitored active agents with matching logs", () => {
    const agents: PaseoAgent[] = [
      { id: "running-match", status: "running", name: "active" },
      { id: "idle-match", status: "idle", name: "idle" },
      { id: "running-clean", status: "running", name: "clean" },
    ];
    const logs = new Map([
      ["running-match", "[System Error] Selected model is at capacity. Please try a different model."],
      ["idle-match", "[System Error] Selected model is at capacity. Please try a different model."],
      ["running-clean", "normal output"],
    ]);

    const actions = planKeepGoingActions(
      agents,
      (agent) => logs.get(agent.id ?? "") ?? "",
      { sent: {} },
      1_000_000,
      baseConfig,
    );

    expect(actions).toContainEqual({
      kind: "send",
      agentId: "running-match",
      agentName: "active",
      fingerprint: "[System Error] Selected model is at capacity. Please try a different model.",
    });
    expect(actions).toContainEqual({
      kind: "skip",
      agentId: "idle-match",
      agentName: "idle",
      reason: "status idle not monitored",
    });
    expect(actions).toContainEqual({
      kind: "skip",
      agentId: "running-clean",
      agentName: "clean",
      reason: "no matching transient error",
    });
  });

  test("skips agents older than max age before reading logs", () => {
    let logReads = 0;

    const actions = planKeepGoingActions(
      [
        { id: "fresh", status: "running", created: "23 hours ago", name: "fresh" },
        { id: "old", status: "running", created: "25 hours ago", name: "old" },
      ],
      () => {
        logReads++;
        return "[System Error] Selected model is at capacity. Please try a different model.";
      },
      { sent: {} },
      1_000_000,
      { ...baseConfig, maxAgeMs: 24 * 60 * 60 * 1000 },
    );

    expect(logReads).toBe(1);
    expect(actions).toContainEqual({
      kind: "skip",
      agentId: "old",
      agentName: "old",
      reason: "created 25 hours ago exceeds max age",
    });
    expect(actions.find((action) => action.kind === "send" && action.agentId === "fresh")).toBeDefined();
  });

  test("parses Paseo relative created ages", () => {
    expect(parseCreatedAgeMs("just now")).toBe(0);
    expect(parseCreatedAgeMs("90 seconds ago")).toBe(90_000);
    expect(parseCreatedAgeMs("2 hours ago")).toBe(2 * 60 * 60 * 1000);
    expect(parseCreatedAgeMs("1 days ago")).toBe(24 * 60 * 60 * 1000);
    expect(parseCreatedAgeMs("unknown")).toBeUndefined();
  });

  test("suppresses duplicate sends while the agent is cooling down", () => {
    const state: KeepGoingState = {
      sent: {
        agent: {
          fingerprint: "previous transient error",
          sentAt: 1_000,
        },
      },
    };

    const actions = planKeepGoingActions(
      [{ id: "agent", status: "running" }],
      () => "[System Error] Selected model is at capacity. Please try a different model.",
      state,
      1_000 + 599_999,
      baseConfig,
    );

    expect(actions).toEqual([
      {
        kind: "skip",
        agentId: "agent",
        reason: "agent already received keep-going recently",
      },
    ]);
  });

  test("allows a resend after cooldown expires", () => {
    const state: KeepGoingState = {
      sent: {
        agent: {
          fingerprint: "[System Error] Selected model is at capacity. Please try a different model.",
          sentAt: 1_000,
        },
      },
    };

    const actions = planKeepGoingActions(
      [{ id: "agent", status: "running" }],
      () => "[System Error] Selected model is at capacity. Please try a different model.",
      state,
      1_000 + 600_000,
      baseConfig,
    );

    expect(actions[0]?.kind).toBe("send");
  });

  test("skips when a matching error has a later monitor keep-going prompt", () => {
    const actions = planKeepGoingActions(
      [{ id: "agent", status: "running" }],
      () => `
        [System Error] Selected model is at capacity. Please try a different model.
        [User] ${keepGoingPrompt}
      `,
      { sent: {} },
      1_000,
      baseConfig,
    );

    expect(actions).toEqual([
      {
        kind: "skip",
        agentId: "agent",
        reason: "matching error already has a later keep-going prompt",
      },
    ]);
  });

  test("sends when a resumed session later logs another transient error", () => {
    const actions = planKeepGoingActions(
      [{ id: "agent", status: "running" }],
      () => `
        editing files.[System Error] stream disconnected before completion: Transport error: timeout
        [User] ${keepGoingPrompt}
        [System Error] Selected model is at capacity. Please try a different model.
      `,
      { sent: {} },
      1_000,
      {
        ...baseConfig,
        patterns: [
          ...baseConfig.patterns,
          /^.*\[System Error\]\s*stream disconnected before completion:\s*Transport error:\s*timeout\s*$/i,
        ],
      },
    );

    expect(actions).toEqual([
      {
        kind: "send",
        agentId: "agent",
        fingerprint: "[System Error] Selected model is at capacity. Please try a different model.",
      },
    ]);
  });

  test("recognizes the shorter resume prompt variant from manual recovery", () => {
    const actions = planKeepGoingActions(
      [{ id: "agent", status: "running" }],
      () => `
        [System Error] Selected model is at capacity. Please try a different model.
        [User] A transient API error interrupted your previous turn. Continue from the last valid state. Do not restart from scratch.
      `,
      { sent: {} },
      1_000,
      baseConfig,
    );

    expect(actions[0]).toMatchObject({
      kind: "skip",
      agentId: "agent",
      reason: "matching error already has a later keep-going prompt",
    });
  });

  test("excludes the monitor's own Paseo agent when an id is provided", () => {
    const actions = planKeepGoingActions(
      [{ id: "self", shortId: "sel", status: "running", name: "monitor" }],
      () => "[System Error] Selected model is at capacity. Please try a different model.",
      { sent: {} },
      1_000,
      { ...baseConfig, selfAgentId: "self" },
    );

    expect(actions).toEqual([
      {
        kind: "skip",
        agentId: "self",
        agentName: "monitor",
        reason: "self agent excluded",
      },
    ]);
  });

  test("parses monitor options without touching process state", () => {
    const config = parseArgs(
      [
        "--once",
        "--dry-run",
        "--verbose",
        "--interval",
        "5",
        "--cooldown",
        "20",
        "--tail",
        "12",
        "--statuses",
        "running,idle",
        "--state",
        "/tmp/state.json",
        "--paseo-bin",
        "/bin/paseo",
        "--prompt",
        "continue",
        "--pattern",
        "temporarily unavailable",
      ],
      { HOME: "/home/demo" },
    );

    expect(config.once).toBe(true);
    expect(config.dryRun).toBe(true);
    expect(config.verbose).toBe(true);
    expect(config.intervalMs).toBe(5_000);
    expect(config.cooldownMs).toBe(20_000);
    expect(config.maxAgeMs).toBe(24 * 60 * 60 * 1000);
    expect(config.tail).toBe(12);
    expect(config.statuses).toEqual(new Set(["running", "idle"]));
    expect(config.statePath).toBe("/tmp/state.json");
    expect(config.paseoBin).toBe("/bin/paseo");
    expect(config.prompt).toBe("continue");
    expect(config.patterns.at(-1)?.test("temporarily unavailable")).toBe(true);
  });

  test("parses max age and default status options", () => {
    const defaults = parseArgs([], { HOME: "/home/demo" });
    expect(defaults.statuses).toEqual(new Set(["running", "error"]));
    expect(defaults.tail).toBe(300);
    expect(defaults.cleanupOrphanCodex).toBe(false);
    expect(defaults.cleanupApply).toBe(false);
    expect(defaults.cleanupOnly).toBe(false);
    expect(defaults.cleanupMinAgeMs).toBe(30 * 60 * 1000);
    expect(parseArgs(["--max-age-hours", "0"], { HOME: "/home/demo" }).maxAgeMs).toBeUndefined();
    expect(parseArgs(["--max-age-hours", "6"], { HOME: "/home/demo" }).maxAgeMs).toBe(6 * 60 * 60 * 1000);
    expect(parseArgs(["--cleanup-orphans"], { HOME: "/home/demo" }).cleanupOrphanCodex).toBe(true);
    expect(parseArgs(["--cleanup-apply"], { HOME: "/home/demo" })).toMatchObject({
      cleanupOrphanCodex: true,
      cleanupApply: true,
    });
    expect(parseArgs(["--cleanup-only"], { HOME: "/home/demo" })).toMatchObject({
      cleanupOrphanCodex: true,
      cleanupOnly: true,
    });
    expect(parseArgs(["--cleanup-apply", "--no-cleanup-orphans"], { HOME: "/home/demo" })).toMatchObject({
      cleanupOrphanCodex: false,
      cleanupApply: false,
      cleanupOnly: false,
    });
    expect(parseArgs(["--cleanup-min-age-minutes", "5"], { HOME: "/home/demo" }).cleanupMinAgeMs).toBe(5 * 60 * 1000);
  });

  test("refuses orphan cleanup with a custom Paseo binary unless explicitly allowed", () => {
    const config = parseArgs(["--cleanup-orphans", "--paseo-bin", "/tmp/fake-paseo"], { HOME: "/home/demo" });

    expect(() => validateConfig(config)).toThrow(/custom --paseo-bin/);
    expect(() =>
      validateConfig(
        parseArgs(["--cleanup-orphans", "--paseo-bin", "/tmp/fake-paseo"], {
          HOME: "/home/demo",
          PASEO_KEEP_GOING_ALLOW_CUSTOM_PASEO_BIN_CLEANUP: "1",
        }),
      ),
    ).not.toThrow();
  });

  test("plans orphan Codex cleanup only for stale inactive Paseo app-server groups", () => {
    const processes: CodexAppServerProcess[] = [
      {
        pid: 101,
        pgid: 100,
        ageMs: 2 * 60 * 60 * 1000,
        paseoAgentId: "active-agent",
        command: "node codex app-server --enable goals",
      },
      {
        pid: 102,
        pgid: 100,
        ageMs: 2 * 60 * 60 * 1000,
        paseoAgentId: "active-agent",
        command: "codex app-server --enable goals",
      },
      {
        pid: 201,
        pgid: 200,
        ageMs: 2 * 60 * 60 * 1000,
        paseoAgentId: "old-orphan",
        command: "node codex app-server --enable goals",
      },
      {
        pid: 202,
        pgid: 200,
        ageMs: 2 * 60 * 60 * 1000,
        paseoAgentId: "old-orphan",
        command: "codex app-server --enable goals",
      },
      {
        pid: 301,
        pgid: 300,
        ageMs: 5 * 60 * 1000,
        paseoAgentId: "fresh-orphan",
        command: "node codex app-server --enable goals",
      },
      {
        pid: 401,
        pgid: 400,
        ageMs: 2 * 60 * 60 * 1000,
        command: "node codex app-server --enable goals",
      },
    ];

    const actions = planOrphanCodexCleanup(processes, new Set(["active-agent"]), 30 * 60 * 1000);

    expect(actions).toContainEqual({
      kind: "terminate",
      pid: 201,
      pids: [201, 202],
      pgid: 200,
      paseoAgentId: "old-orphan",
      ageMs: 2 * 60 * 60 * 1000,
      processCount: 2,
    });
    expect(actions).toContainEqual({
      kind: "skip",
      pid: 101,
      pids: [101, 102],
      pgid: 100,
      paseoAgentId: "active-agent",
      ageMs: 2 * 60 * 60 * 1000,
      processCount: 2,
      reason: "active Paseo agent",
    });
    expect(actions).toContainEqual({
      kind: "skip",
      pid: 301,
      pids: [301],
      pgid: 300,
      paseoAgentId: "fresh-orphan",
      ageMs: 5 * 60 * 1000,
      processCount: 1,
      reason: "younger than cleanup minimum",
    });
    expect(actions).toContainEqual({
      kind: "skip",
      pid: 401,
      pids: [401],
      pgid: 400,
      ageMs: 2 * 60 * 60 * 1000,
      processCount: 1,
      reason: "not Paseo-managed",
    });
  });

  test("does not terminate process groups with mixed Paseo agent ids", () => {
    const actions = planOrphanCodexCleanup(
      [
        {
          pid: 101,
          pgid: 100,
          ageMs: 2 * 60 * 60 * 1000,
          paseoAgentId: "agent-a",
          command: "node codex app-server --enable goals",
        },
        {
          pid: 102,
          pgid: 100,
          ageMs: 2 * 60 * 60 * 1000,
          paseoAgentId: "agent-b",
          command: "codex app-server --enable goals",
        },
      ],
      new Set(),
      30 * 60 * 1000,
    );

    expect(actions).toEqual([
      {
        kind: "skip",
        pid: 101,
        pids: [101, 102],
        pgid: 100,
        paseoAgentId: "agent-a,agent-b",
        ageMs: 2 * 60 * 60 * 1000,
        processCount: 2,
        reason: "ambiguous Paseo agent ids",
      },
    ]);
  });

  test("treats an empty state file as initial state", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "paseo-keep-going-"));
    try {
      const statePath = join(tempDir, "state.json");
      writeFileSync(statePath, "");

      expect(readState(statePath)).toEqual({ sent: {} });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("normalizes legacy state fingerprints that included tail line numbers", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "paseo-keep-going-"));
    try {
      const statePath = join(tempDir, "state.json");
      writeFileSync(
        statePath,
        JSON.stringify({
          sent: {
            agent: {
              fingerprint: "25:[System Error] Selected model is at capacity. Please try a different model.",
              sentAt: 1_000,
            },
          },
        }),
      );

      expect(readState(statePath).sent.agent?.fingerprint).toBe(
        "[System Error] Selected model is at capacity. Please try a different model.",
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("CLI dry-run does not write state while real sends do", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "paseo-keep-going-cli-"));
    const fakePaseo = join(tempDir, "paseo");
    const statePath = join(tempDir, "state.json");
    const callsPath = join(tempDir, "calls.log");
    const scriptPath = resolve(process.cwd(), "scripts", "lib", "paseo-keep-going.ts");

    try {
      writeFileSync(
        fakePaseo,
        [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          `printf '%s\\n' "$*" >> ${shellQuote(callsPath)}`,
          "case \"$1\" in",
          "  ls)",
          "    printf '%s\\n' '[{\"id\":\"agent\",\"name\":\"demo\",\"status\":\"running\"}]'",
          "    ;;",
          "  logs)",
          "    printf '%s\\n' '[System Error] Selected model is at capacity. Please try a different model.'",
          "    ;;",
          "  send)",
          "    exit 0",
          "    ;;",
          "  *)",
          "    exit 64",
          "    ;;",
          "esac",
          "",
        ].join("\n"),
        { mode: 0o755 },
      );

      const dryRun = spawnSync("bun", [scriptPath, "--once", "--dry-run", "--paseo-bin", fakePaseo, "--state", statePath], {
        encoding: "utf8",
      });
      expect(dryRun.status).toBe(0);
      expect(existsSync(statePath)).toBe(false);

      const realRun = spawnSync("bun", [scriptPath, "--once", "--paseo-bin", fakePaseo, "--state", statePath], {
        encoding: "utf8",
      });
      expect(realRun.status).toBe(0);
      expect(readFileSync(callsPath, "utf8")).toContain("send --no-wait --prompt");
      expect(readFileSync(callsPath, "utf8")).toContain("agent");
      expect(JSON.parse(readFileSync(statePath, "utf8")).sent.agent.fingerprint).toBe(
        "[System Error] Selected model is at capacity. Please try a different model.",
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("CLI cleanup with a fake Paseo binary fails before process discovery", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "paseo-keep-going-cli-"));
    const fakePaseo = join(tempDir, "paseo");
    const fakePs = join(tempDir, "ps");
    const psTouched = join(tempDir, "ps-touched");
    const scriptPath = resolve(process.cwd(), "scripts", "lib", "paseo-keep-going.ts");

    try {
      writeFileSync(
        fakePaseo,
        [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          "printf '%s\\n' '[{\"id\":\"fake-active\",\"status\":\"running\"}]'",
          "",
        ].join("\n"),
        { mode: 0o755 },
      );
      writeFileSync(
        fakePs,
        [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          `touch ${shellQuote(psTouched)}`,
          "exit 0",
          "",
        ].join("\n"),
        { mode: 0o755 },
      );

      const result = spawnSync("bun", [scriptPath, "--once", "--cleanup-only", "--paseo-bin", fakePaseo], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${tempDir}:${process.env.PATH ?? ""}` },
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("custom --paseo-bin");
      expect(existsSync(psTouched)).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("CLI records failed sends for cooldown while preserving later successful sends", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "paseo-keep-going-cli-"));
    const fakePaseo = join(tempDir, "paseo");
    const statePath = join(tempDir, "state.json");
    const scriptPath = resolve(process.cwd(), "scripts", "lib", "paseo-keep-going.ts");

    try {
      writeFileSync(
        fakePaseo,
        [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          "case \"$1\" in",
          "  ls)",
          "    printf '%s\\n' '[{\"id\":\"fails\",\"name\":\"fails\",\"status\":\"running\"},{\"id\":\"works\",\"name\":\"works\",\"status\":\"running\"}]'",
          "    ;;",
          "  logs)",
          "    printf '%s\\n' '[System Error] Selected model is at capacity. Please try a different model.'",
          "    ;;",
          "  send)",
          "    if [[ \"$5\" == \"fails\" ]]; then exit 1; fi",
          "    exit 0",
          "    ;;",
          "  *)",
          "    exit 64",
          "    ;;",
          "esac",
          "",
        ].join("\n"),
        { mode: 0o755 },
      );

      const result = spawnSync("bun", [scriptPath, "--once", "--paseo-bin", fakePaseo, "--state", statePath], {
        encoding: "utf8",
      });
      expect(result.status).toBe(0);
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      expect(state.sent.fails.fingerprint).toBe("[System Error] Selected model is at capacity. Please try a different model.");
      expect(state.sent.works.fingerprint).toBe("[System Error] Selected model is at capacity. Please try a different model.");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("CLI records failed sends for cooldown suppression", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "paseo-keep-going-cli-"));
    const fakePaseo = join(tempDir, "paseo");
    const statePath = join(tempDir, "state.json");
    const scriptPath = resolve(process.cwd(), "scripts", "lib", "paseo-keep-going.ts");

    try {
      writeFileSync(
        fakePaseo,
        [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          "case \"$1\" in",
          "  ls)",
          "    printf '%s\\n' '[{\"id\":\"fails\",\"name\":\"fails\",\"status\":\"running\"}]'",
          "    ;;",
          "  logs)",
          "    printf '%s\\n' '[System Error] Selected model is at capacity. Please try a different model.'",
          "    ;;",
          "  send)",
          "    exit 1",
          "    ;;",
          "  *)",
          "    exit 64",
          "    ;;",
          "esac",
          "",
        ].join("\n"),
        { mode: 0o755 },
      );

      const result = spawnSync("bun", [scriptPath, "--once", "--paseo-bin", fakePaseo, "--state", statePath], {
        encoding: "utf8",
      });

      expect(result.status).toBe(0);
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      expect(state.sent.fails.fingerprint).toBe("[System Error] Selected model is at capacity. Please try a different model.");
      expect(typeof state.sent.fails.sentAt).toBe("number");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
