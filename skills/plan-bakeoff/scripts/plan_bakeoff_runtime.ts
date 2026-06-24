import { existsSync, readFileSync } from "node:fs";
import type { Candidate } from "./plan_bakeoff_manifest";

export type WorkerTiming = {
  timeoutMin: number;
  idleTimeoutMin: number;
  timeoutGraceMin: number;
  pollIntervalSec: number;
};

const SECRET_KEY_PATTERN = /(API[_-]?KEY|TOKEN|AUTH|SECRET|PASSWORD|BASE_URL)$/i;
const SECRET_TEXT_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /(authorization:\s*bearer\s+)[^\s'"<>]+/gi,
] as RegExp[];

const PROVIDER_DEFAULTS: Record<string, Record<string, string>> = {
  "minimax-anthropic": {
    ANTHROPIC_BASE_URL: "https://api.minimaxi.com/anthropic",
  },
  "kimi-anthropic": {
    ANTHROPIC_BASE_URL: "https://api.kimi.com/coding/",
  },
  "mimo-tp-anthropic": {
    ANTHROPIC_BASE_URL: "https://token-plan-cn.xiaomimimo.com/anthropic",
  },
};

const PROVIDER_ENV_KEY: Record<string, string> = {
  "codex-router-responses": "CODEX_API_KEY",
  "minimax-responses": "MM_API_KEY",
};

const PROVIDER_BASE_URL_ENV: Record<string, string> = {
  "codex-router-responses": "CODEX_BASE_URL",
  "minimax-responses": "MM_BASE_URL",
};

const PROVIDER_BASE_URL_DEFAULT: Record<string, string> = {
  "minimax-responses": "https://api.minimaxi.com/v1",
};

export const loadDotenv = (path: string, env: Record<string, string | undefined> = process.env): Record<string, string> => {
  if (!existsSync(path)) {
    return {};
  }
  const loaded: Record<string, string> = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const [keyPart, ...valueParts] = line.split("=");
    const key = keyPart.trim();
    if (!key || env[key] !== undefined) {
      continue;
    }
    const value = stripQuotes(valueParts.join("=").trim());
    loaded[key] = value;
    env[key] = value;
  }
  return loaded;
};

export const redactText = (text: string, env: Record<string, string | undefined> = process.env): string => {
  let redacted = text;
  for (const [key, value] of Object.entries(env)) {
    if (value && value.length >= 6 && SECRET_KEY_PATTERN.test(key)) {
      redacted = redacted.split(value).join("[REDACTED]");
    }
  }
  for (const pattern of SECRET_TEXT_PATTERNS) {
    redacted = redacted.replace(pattern, (_match: string, prefix?: string) => prefix ? `${prefix}[REDACTED]` : "[REDACTED]");
  }
  return redacted;
};

export const candidateMappedEnv = (candidate: Candidate, env: Record<string, string | undefined>): Record<string, string> => {
  const mapped: Record<string, string> = { ...(PROVIDER_DEFAULTS[candidate.provider_profile ?? ""] ?? {}) };
  for (const [targetKey, sourceKey] of Object.entries(candidate.env ?? {})) {
    const value = env[sourceKey];
    if (value !== undefined) {
      mapped[targetKey] = normalizeMappedEnv(targetKey, value, candidate.provider_profile ?? "");
    }
  }
  return mapped;
};

export const commonSkillRunnerArgs = (
  candidate: Candidate,
  worktree: string,
  workerRunRoot: string,
  timing: WorkerTiming,
): string[] => {
  const args = [
    "--cwd",
    worktree,
    "--run-root",
    workerRunRoot,
    "--timeout-min",
    String(timing.timeoutMin + timing.timeoutGraceMin),
    "--idle-timeout-min",
    String(timing.idleTimeoutMin),
    "--poll-interval-sec",
    String(timing.pollIntervalSec),
  ];
  for (const skill of candidate.skills ?? []) {
    args.push("--selected-skill", skill);
  }
  if ((candidate.skills ?? []).length > 0) {
    args.push("--materialize-skills");
  }
  return args;
};

export const skillRunnerArgsForCandidate = (
  candidate: Candidate,
  worktree: string,
  workerRunRoot: string,
  timing: WorkerTiming,
  env: Record<string, string | undefined> = process.env,
): string[] => {
  const args = commonSkillRunnerArgs(candidate, worktree, workerRunRoot, timing);
  if (candidate.harness === "codex-cli") {
    const provider = candidate.provider_profile ?? "codex-router-responses";
    args.push("--agent", "codex");
    args.push("--launch-mode", candidate.launch_mode ?? "prompt-exec");
    if (candidate.model) {
      args.push("--model", candidate.model);
    }
    args.push("--codex-provider", provider);
    args.push("--codex-provider-base-url", codexProviderBaseUrl(provider, env));
    args.push("--codex-provider-env-key", PROVIDER_ENV_KEY[provider] ?? "CODEX_API_KEY");
    args.push("--codex-wire-api", "responses");
    return args;
  }
  if (candidate.harness === "claude-code") {
    args.push("--agent", "claude");
    args.push("--launch-mode", candidate.launch_mode ?? "interactive-tmux");
    if (candidate.model) {
      args.push("--model", candidate.model);
    }
    return args;
  }
  if (candidate.harness === "command" && candidate.command?.trim()) {
    args.push("--agent-command", shellQuoteCommand(["bash", "-lc", candidate.command]));
    return args;
  }
  throw new Error(`candidate ${candidate.id}: unsupported real harness ${candidate.harness}`);
};

const stripQuotes = (value: string): string => {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
};

const normalizeMappedEnv = (targetKey: string, value: string, provider: string): string => {
  if (targetKey !== "ANTHROPIC_BASE_URL") {
    return value;
  }
  if (provider === "minimax-anthropic") {
    return stripTrailingV1(value) + "/anthropic";
  }
  return stripTrailingV1(value);
};

const stripTrailingV1 = (value: string): string =>
  value.replace(/\/v1\/?$/, "");

const codexProviderBaseUrl = (provider: string, env: Record<string, string | undefined>): string => {
  const envKey = PROVIDER_BASE_URL_ENV[provider];
  return (envKey ? env[envKey] : undefined) ?? PROVIDER_BASE_URL_DEFAULT[provider] ?? env.CODEX_BASE_URL ?? "";
};

const shellQuoteCommand = (command: string[]): string =>
  command.map((part) => `'${part.replace(/'/g, "'\\''")}'`).join(" ");
