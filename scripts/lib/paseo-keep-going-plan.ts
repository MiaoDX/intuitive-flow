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

export type KeepGoingDecisionConfig = {
  statuses: Set<string>;
  patterns: RegExp[];
  cooldownMs: number;
  maxAgeMs?: number;
  includeSelf: boolean;
  selfAgentId?: string;
  prompt?: string;
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

export type LogCandidate = {
  kind: "candidate";
  agent: PaseoAgent;
  agentId: string;
  agentName?: string;
};

export type CodexAppServerProcess = {
  pid: number;
  ppid?: number;
  pgid?: number;
  ageMs: number;
  paseoAgentId?: string;
  command: string;
};

export type OrphanCodexCleanupAction =
  | {
      kind: "terminate";
      pid: number;
      pids: number[];
      pgid?: number;
      paseoAgentId: string;
      ageMs: number;
      processCount: number;
    }
  | {
      kind: "skip";
      pid: number;
      pids: number[];
      pgid?: number;
      paseoAgentId?: string;
      ageMs: number;
      processCount: number;
      reason: string;
    };

export const DEFAULT_PATTERNS = [
  /^.*\[System Error\]\s*Selected model is at capacity\. Please try a different model\.\s*$/i,
  /^.*\[System Error\]\s*stream disconnected before completion:\s*error sending request for url\s*\(.+\)\s*$/i,
  /^.*\[System Error\]\s*stream disconnected before completion:\s*Transport error:\s*timeout\s*$/i,
  /^.*\[System Error\]\s*stream disconnected before completion:\s*stream closed before response\.completed\s*$/i,
  /^.*\[System Error\]\s*stream disconnected before completion:\s*Concurrency limit exceeded for account,\s*please retry later\s*$/i,
  /^.*\[System Error\]\s*stream disconnected before completion:\s*Upstream request failed\s*$/i,
];

export const DEFAULT_PROMPT =
  "The previous turn appears to have been interrupted by a transient API error. Please continue from your last valid state and keep going. Do not restart from scratch.";

const KEEP_GOING_PROMPT_PATTERNS = [
  /the previous turn appears to have been interrupted by a transient (?:model-capacity\/)?api error/i,
  /a transient api error interrupted your previous turn/i,
  /please continue from your last valid state and keep going\. do not restart from scratch/i,
  /continue from the last valid state\. do not restart from scratch/i,
];

export function planKeepGoingActions(
  agents: PaseoAgent[],
  readAgentLog: (agent: PaseoAgent) => string,
  state: KeepGoingState,
  now: number,
  config: KeepGoingDecisionConfig,
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

export function preflightAgent(
  agent: PaseoAgent,
  config: Pick<KeepGoingDecisionConfig, "statuses" | "maxAgeMs" | "includeSelf" | "selfAgentId">,
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

export function planOrphanCodexCleanup(
  processes: CodexAppServerProcess[],
  activeAgentIds: Set<string>,
  minAgeMs: number,
): OrphanCodexCleanupAction[] {
  const groups = new Map<string, CodexAppServerProcess[]>();
  for (const process of processes) {
    const key = String(process.pgid ?? process.pid);
    groups.set(key, [...(groups.get(key) ?? []), process]);
  }

  const actions: OrphanCodexCleanupAction[] = [];
  for (const group of groups.values()) {
    const representative = group[0];
    if (representative === undefined) continue;

    const agentIds = new Set(group.map((process) => process.paseoAgentId).filter((value): value is string => value !== undefined));
    const ageMs = Math.min(...group.map((process) => process.ageMs));
    const base = {
      pid: representative.pid,
      pids: group.map((process) => process.pid).sort((left, right) => left - right),
      pgid: representative.pgid,
      ageMs,
      processCount: group.length,
    };

    if (agentIds.size === 0) {
      actions.push({ ...base, kind: "skip", reason: "not Paseo-managed" });
      continue;
    }

    if (agentIds.size > 1) {
      actions.push({ ...base, kind: "skip", paseoAgentId: [...agentIds].join(","), reason: "ambiguous Paseo agent ids" });
      continue;
    }

    const [agentId] = agentIds;
    if (agentId === undefined) {
      actions.push({ ...base, kind: "skip", reason: "not Paseo-managed" });
      continue;
    }

    if (activeAgentIds.has(agentId)) {
      actions.push({ ...base, kind: "skip", paseoAgentId: agentId, reason: "active Paseo agent" });
      continue;
    }

    if (ageMs < minAgeMs) {
      actions.push({ ...base, kind: "skip", paseoAgentId: agentId, reason: "younger than cleanup minimum" });
      continue;
    }

    actions.push({ ...base, kind: "terminate", paseoAgentId: agentId });
  }

  return actions.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "terminate" ? -1 : 1;
    return right.ageMs - left.ageMs;
  });
}

export function planCandidateLogAction(
  candidate: LogCandidate,
  logText: string,
  state: KeepGoingState,
  now: number,
  config: Pick<KeepGoingDecisionConfig, "patterns" | "cooldownMs" | "prompt">,
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

export function scanLogSignals(
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

export const normalizeFingerprint = (value: string): string => value.replace(/^\d+:/, "");

const isKeepGoingPromptLine = (line: string, prompt: string): boolean => {
  const text = stripLogSpeaker(line);
  if (prompt.trim().length > 0 && text.includes(prompt.trim())) return true;
  return KEEP_GOING_PROMPT_PATTERNS.some((pattern) => pattern.test(text));
};

const stripLogSpeaker = (line: string): string => line.trim().replace(/^\[[^\]]+\]\s*/, "");

export const normalizeStatus = (value: string | undefined): string => value?.trim().toLowerCase() ?? "";
