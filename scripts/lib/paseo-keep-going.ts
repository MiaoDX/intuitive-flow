import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  DEFAULT_PATTERNS,
  DEFAULT_PROMPT,
  normalizeFingerprint,
  normalizeStatus,
  planCandidateLogAction,
  preflightAgent,
  type KeepGoingState,
  type LogCandidate,
  type PaseoAgent,
  type ScanAction,
  type SentRecord,
} from "./paseo-keep-going-plan";

export type KeepGoingConfig = {
  statuses: Set<string>;
  patterns: RegExp[];
  cooldownMs: number;
  tail: number;
  prompt: string;
  statePath: string;
  paseoBin: string;
  dryRun: boolean;
  verbose: boolean;
  once: boolean;
  intervalMs: number;
  maxAgeMs?: number;
  includeSelf: boolean;
  selfAgentId?: string;
};

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  await runMonitor(config);
}

export async function runMonitor(config: KeepGoingConfig): Promise<void> {
  while (true) {
    try {
      await scanOnce(config);
    } catch (error) {
      if (config.once) throw error;
      const message = error instanceof Error ? error.message : String(error);
      log(`scan failed: ${message}`);
    }

    if (config.once) return;
    await sleep(config.intervalMs);
  }
}

async function scanOnce(config: KeepGoingConfig): Promise<void> {
  const state = readState(config.statePath);
  const agents = listAgents(config);
  const now = Date.now();
  const actions: ScanAction[] = [];
  const candidates: LogCandidate[] = [];

  for (const agent of agents) {
    const decision = preflightAgent(agent, config);
    if (decision === undefined) continue;
    if (decision.kind === "candidate") candidates.push(decision);
    else actions.push(decision);
  }

  const logEntries = await Promise.all(
    candidates.map(async (candidate): Promise<[LogCandidate, string]> => [candidate, await readLogs(config, candidate.agent)]),
  );
  for (const [candidate, logText] of logEntries) {
    actions.push(planCandidateLogAction(candidate, logText, state, now, config));
  }

  for (const action of actions) {
    if (action.kind === "skip") {
      if (config.verbose) log(`skip ${label(action)}: ${action.reason}`);
      continue;
    }

    if (config.dryRun) {
      log(`dry-run would send keep-going to ${label(action)}`);
      continue;
    }

    try {
      sendKeepGoing(config, action.agentId);
      state.sent[action.agentId] = {
        fingerprint: action.fingerprint,
        sentAt: Date.now(),
      };
      writeState(config.statePath, state);
      log(`sent keep-going to ${label(action)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`failed to send keep-going to ${label(action)}: ${message}`);
    }
  }
}

export function readState(path: string): KeepGoingState {
  if (!existsSync(path)) return { sent: {} };
  const raw = readFileSync(path, "utf8");
  if (raw.trim().length === 0) return { sent: {} };
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || !isRecord(parsed.sent)) return { sent: {} };

  const sent: Record<string, SentRecord> = {};
  for (const [agentId, value] of Object.entries(parsed.sent)) {
    if (!isRecord(value) || typeof value.fingerprint !== "string" || typeof value.sentAt !== "number") continue;
    sent[agentId] = {
      fingerprint: normalizeFingerprint(value.fingerprint),
      sentAt: value.sentAt,
    };
  }
  return { sent };
}

export function writeState(path: string, state: KeepGoingState): void {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tempPath, path);
}

function listAgents(config: KeepGoingConfig): PaseoAgent[] {
  const result = spawnSync(config.paseoBin, ["ls", "--json"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`paseo ls failed: ${result.stderr || result.stdout}`);
  }

  const parsed: unknown = JSON.parse(result.stdout);
  if (!Array.isArray(parsed)) throw new Error("paseo ls --json did not return an array");
  return parsed.filter(isRecord).map((agent) => ({
    id: stringField(agent, "id"),
    shortId: stringField(agent, "shortId"),
    name: stringField(agent, "name"),
    status: stringField(agent, "status"),
    cwd: stringField(agent, "cwd"),
    created: stringField(agent, "created"),
  }));
}

async function readLogs(config: KeepGoingConfig, agent: PaseoAgent): Promise<string> {
  const agentId = agent.id ?? agent.shortId;
  if (agentId === undefined) return "";

  const result = await spawnText(config.paseoBin, ["logs", agentId, "--tail", String(config.tail)]);
  if (result.status !== 0) {
    if (config.verbose) log(`failed to read logs for ${agentId}: ${result.stderr || result.stdout}`);
    return "";
  }

  return result.stdout;
}

function spawnText(command: string, args: string[]): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks = {
      stdout: "",
      stderr: "",
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      chunks.stdout += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      chunks.stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout: chunks.stdout, stderr: chunks.stderr });
    });
  });
}

function sendKeepGoing(config: KeepGoingConfig, agentId: string): void {
  const result = spawnSync(config.paseoBin, ["send", "--no-wait", "--prompt", config.prompt, agentId], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`paseo send failed for ${agentId}: ${result.stderr || result.stdout}`);
  }
}

export function parseArgs(args: string[], env: NodeJS.ProcessEnv = process.env): KeepGoingConfig {
  const home = env.HOME ?? ".";
  const config: KeepGoingConfig = {
    statuses: new Set(["running", "error"]),
    patterns: [...DEFAULT_PATTERNS],
    cooldownMs: 10 * 60 * 1000,
    tail: 300,
    prompt: DEFAULT_PROMPT,
    statePath: `${home}/.cache/intuitive-flow/paseo-keep-going-state.json`,
    paseoBin: env.PASEO_BIN ?? "paseo",
    dryRun: false,
    verbose: false,
    once: false,
    intervalMs: 30 * 1000,
    maxAgeMs: 24 * 60 * 60 * 1000,
    includeSelf: false,
    selfAgentId: env.PASEO_KEEP_GOING_SELF_AGENT_ID,
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    switch (arg) {
      case "--once":
        config.once = true;
        break;
      case "--dry-run":
        config.dryRun = true;
        break;
      case "--verbose":
        config.verbose = true;
        break;
      case "--include-self":
        config.includeSelf = true;
        break;
      case "--interval":
        config.intervalMs = parsePositiveNumber(nextArg(args, ++index, arg), arg) * 1000;
        break;
      case "--cooldown":
        config.cooldownMs = parsePositiveNumber(nextArg(args, ++index, arg), arg) * 1000;
        break;
      case "--max-age-hours": {
        const hours = parseNonNegativeNumber(nextArg(args, ++index, arg), arg);
        config.maxAgeMs = hours === 0 ? undefined : hours * 60 * 60 * 1000;
        break;
      }
      case "--tail":
        config.tail = parsePositiveNumber(nextArg(args, ++index, arg), arg);
        break;
      case "--state":
        config.statePath = nextArg(args, ++index, arg);
        break;
      case "--paseo-bin":
        config.paseoBin = nextArg(args, ++index, arg);
        break;
      case "--prompt":
        config.prompt = nextArg(args, ++index, arg);
        break;
      case "--statuses":
        config.statuses = new Set(
          nextArg(args, ++index, arg)
            .split(",")
            .map(normalizeStatus)
            .filter(Boolean),
        );
        break;
      case "--pattern":
        config.patterns.push(new RegExp(nextArg(args, ++index, arg), "i"));
        break;
      case "--help":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (config.statuses.size === 0) throw new Error("--statuses must include at least one value");
  return config;
}

function nextArg(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function parsePositiveNumber(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number`);
  return parsed;
}

function parseNonNegativeNumber(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative number`);
  return parsed;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function label(action: { agentId: string; agentName?: string }): string {
  return action.agentName === undefined ? action.agentId : `${action.agentName} (${action.agentId})`;
}

function log(message: string): void {
  process.stderr.write(`[paseo-keep-going] ${new Date().toISOString()} ${message}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHelp(): void {
  process.stdout.write(`Usage: bun scripts/lib/paseo-keep-going.ts [options]

Monitor active Paseo agents for transient API errors and send a
single keep-going prompt when one is observed.

Options:
  --once                 Scan once and exit
  --dry-run              Report would-send actions without sending prompts
  --verbose              Log skipped agents and command read failures
  --interval <seconds>   Poll interval for daemon mode (default: 30)
  --cooldown <seconds>   Per-agent duplicate-send cooldown (default: 600)
  --max-age-hours <n>    Only inspect agents created within n hours; 0 disables (default: 24)
  --tail <n>             Paseo log tail size per agent (default: 300)
  --statuses <csv>       Agent statuses to monitor (default: running,error)
  --state <path>         State file path
  --paseo-bin <path>     Paseo binary (default: paseo)
  --prompt <text>        Prompt sent through paseo send
  --pattern <regex>      Extra case-insensitive log pattern to match
  --include-self         Do not exclude PASEO_KEEP_GOING_SELF_AGENT_ID
`);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[paseo-keep-going] ${message}\n`);
    process.exit(1);
  }
}
