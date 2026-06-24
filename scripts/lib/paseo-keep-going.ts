import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawn, spawnSync } from "node:child_process";

export type PaseoAgent = {
  id?: string;
  shortId?: string;
  name?: string;
  status?: string;
  cwd?: string;
  created?: string;
};

export type KeepGoingState = {
  sent: Record<string, SentRecord>;
};

export type SentRecord = {
  fingerprint: string;
  sentAt: number;
};

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

export type ScanAction =
  | {
      kind: "send";
      agentId: string;
      agentName?: string;
      fingerprint: string;
    }
  | {
      kind: "skip";
      agentId: string;
      agentName?: string;
      reason: string;
    };

type LogCandidate = {
  kind: "candidate";
  agent: PaseoAgent;
  agentId: string;
  agentName?: string;
};

const DEFAULT_PATTERNS = [
  /^.*\[System Error\]\s*Selected model is at capacity\. Please try a different model\.\s*$/i,
  /^.*\[System Error\]\s*stream disconnected before completion:\s*error sending request for url\s*\(.+\)\s*$/i,
  /^.*\[System Error\]\s*stream disconnected before completion:\s*Transport error:\s*timeout\s*$/i,
  /^.*\[System Error\]\s*stream disconnected before completion:\s*stream closed before response\.completed\s*$/i,
];

const DEFAULT_PROMPT =
  "The previous turn appears to have been interrupted by a transient API error. Please continue from your last valid state and keep going. Do not restart from scratch.";

const KEEP_GOING_PROMPT_PATTERNS = [
  /the previous turn appears to have been interrupted by a transient (?:model-capacity\/)?api error/i,
  /a transient api error interrupted your previous turn/i,
  /please continue from your last valid state and keep going\. do not restart from scratch/i,
  /continue from the last valid state\. do not restart from scratch/i,
];

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

export function planKeepGoingActions(
  agents: PaseoAgent[],
  readAgentLog: (agent: PaseoAgent) => string,
  state: KeepGoingState,
  now: number,
  config: Pick<KeepGoingConfig, "statuses" | "patterns" | "cooldownMs" | "maxAgeMs" | "includeSelf" | "selfAgentId"> &
    Partial<Pick<KeepGoingConfig, "prompt">>,
): ScanAction[] {
  const actions: ScanAction[] = [];

  for (const agent of agents) {
    const decision = preflightAgent(agent, config);
    if (decision === undefined) continue;
    if (decision.kind !== "candidate") {
      actions.push(decision);
      continue;
    }

    actions.push(planCandidateLogAction(decision, readAgentLog(agent), state, now, config));
  }

  return actions;
}

function preflightAgent(
  agent: PaseoAgent,
  config: Pick<KeepGoingConfig, "statuses" | "maxAgeMs" | "includeSelf" | "selfAgentId">,
): LogCandidate | ScanAction | undefined {
  const agentId = agent.id ?? agent.shortId;
  if (agentId === undefined || agentId.length === 0) return undefined;
  const agentName = agent.name;

  if (!config.includeSelf && config.selfAgentId !== undefined && [agent.id, agent.shortId].includes(config.selfAgentId)) {
    return { kind: "skip", agentId, agentName, reason: "self agent excluded" };
  }

  const status = normalizeStatus(agent.status);
  if (!config.statuses.has(status)) {
    return { kind: "skip", agentId, agentName, reason: `status ${status || "unknown"} not monitored` };
  }

  const ageMs = parseCreatedAgeMs(agent.created);
  if (config.maxAgeMs !== undefined && ageMs !== undefined && ageMs > config.maxAgeMs) {
    return { kind: "skip", agentId, agentName, reason: `created ${agent.created ?? "unknown"} exceeds max age` };
  }

  return { kind: "candidate", agent, agentId, agentName };
}

function planCandidateLogAction(
  candidate: LogCandidate,
  logText: string,
  state: KeepGoingState,
  now: number,
  config: Pick<KeepGoingConfig, "patterns" | "cooldownMs"> & Partial<Pick<KeepGoingConfig, "prompt">>,
): ScanAction {
  const scan = scanLogSignals(logText, config.patterns, config.prompt);
  if (scan.latestError === undefined) {
    return {
      kind: "skip",
      agentId: candidate.agentId,
      agentName: candidate.agentName,
      reason: "no matching transient error",
    };
  }

  if (scan.latestPromptIndex !== undefined && scan.latestPromptIndex > scan.latestError.index) {
    return {
      kind: "skip",
      agentId: candidate.agentId,
      agentName: candidate.agentName,
      reason: "matching error already has a later keep-going prompt",
    };
  }

  const prior = state.sent[candidate.agentId];
  if (prior !== undefined && now - prior.sentAt < config.cooldownMs) {
    return {
      kind: "skip",
      agentId: candidate.agentId,
      agentName: candidate.agentName,
      reason: "agent already received keep-going recently",
    };
  }

  return {
    kind: "send",
    agentId: candidate.agentId,
    agentName: candidate.agentName,
    fingerprint: scan.latestError.fingerprint,
  };
}

export function findCapacityError(logText: string, patterns: RegExp[] = DEFAULT_PATTERNS): { line: string; fingerprint: string } | undefined {
  const match = scanLogSignals(logText, patterns).latestError;
  if (match === undefined) return undefined;
  return {
    line: match.line,
    fingerprint: match.fingerprint,
  };
}

function scanLogSignals(
  logText: string,
  patterns: RegExp[] = DEFAULT_PATTERNS,
  prompt = DEFAULT_PROMPT,
): {
  latestError?: { index: number; line: string; fingerprint: string };
  latestPromptIndex?: number;
} {
  const lines = logText.split(/\r?\n/);
  let latestError: { index: number; line: string; fingerprint: string } | undefined;
  let latestPromptIndex: number | undefined;

  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index]?.trim();
    if (line === undefined || line.length === 0) continue;

    if (latestPromptIndex === undefined && isKeepGoingPromptLine(line, prompt)) {
      latestPromptIndex = index;
    }

    if (latestError === undefined && patterns.some((pattern) => pattern.test(line))) {
      latestError = {
        index,
        line,
        fingerprint: line,
      };
    }

    if (latestError !== undefined && latestPromptIndex !== undefined) break;
  }

  return { latestError, latestPromptIndex };
}

function isKeepGoingPromptLine(line: string, prompt: string): boolean {
  const text = stripLogSpeaker(line);
  if (prompt.trim().length > 0 && text.includes(prompt.trim())) return true;
  return KEEP_GOING_PROMPT_PATTERNS.some((pattern) => pattern.test(text));
}

function stripLogSpeaker(line: string): string {
  return line.trim().replace(/^\[[^\]]+\]\s*/, "");
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

function normalizeStatus(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function parseCreatedAgeMs(value: string | undefined): number | undefined {
  const text = value?.trim().toLowerCase();
  if (text === undefined || text.length === 0) return undefined;
  if (text === "now" || text === "just now") return 0;
  if (text === "yesterday") return 24 * 60 * 60 * 1000;

  const match = text.match(/^(\d+(?:\.\d+)?)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
  if (match === null) return undefined;

  const amount = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };
  return amount * unitMs[unit];
}

function normalizeFingerprint(value: string): string {
  return value.replace(/^\d+:/, "");
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
