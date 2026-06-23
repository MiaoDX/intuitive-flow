import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  findCapacityError,
  parseArgs,
  parseCreatedAgeMs,
  planKeepGoingActions,
  readState,
  type KeepGoingState,
  type PaseoAgent,
} from "./paseo-keep-going";

const baseConfig = {
  statuses: new Set(["running", "error"]),
  patterns: [/\[System Error\]\s*Selected model is at capacity\. Please try a different model\./i],
  cooldownMs: 600_000,
  includeSelf: false,
  selfAgentId: undefined,
};

describe("paseo keep-going monitor", () => {
  test("matches the model-capacity system error from recent Paseo logs", () => {
    const match = findCapacityError(`
      [User] please continue
      [System Error] Selected model is at capacity. Please try a different model.
    `);

    expect(match?.line).toBe("[System Error] Selected model is at capacity. Please try a different model.");
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

  test("suppresses duplicate sends while the same error is cooling down", () => {
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
      1_000 + 599_999,
      baseConfig,
    );

    expect(actions).toEqual([
      {
        kind: "skip",
        agentId: "agent",
        reason: "matching error is still cooling down",
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
    expect(defaults.statuses).toEqual(new Set(["running"]));
    expect(defaults.tail).toBe(20);
    expect(parseArgs(["--max-age-hours", "0"], { HOME: "/home/demo" }).maxAgeMs).toBeUndefined();
    expect(parseArgs(["--max-age-hours", "6"], { HOME: "/home/demo" }).maxAgeMs).toBe(6 * 60 * 60 * 1000);
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

  test("CLI records later successful sends even when an earlier agent send fails", () => {
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
      expect(state.sent.fails).toBeUndefined();
      expect(state.sent.works.fingerprint).toBe("[System Error] Selected model is at capacity. Please try a different model.");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
