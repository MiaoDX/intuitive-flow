import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export const SCHEMA = "plan_bakeoff_manifest_v1";

export const DEFAULT_WORKER_TIMEOUT_MIN = 60;
export const DEFAULT_TIMEOUT_GRACE_MIN = 15;
export const DEFAULT_IDLE_TIMEOUT_MIN = 20;
export const DEFAULT_POLL_INTERVAL_SEC = 1;

export type Manifest = {
  schema: string;
  target_repo: string;
  plan: string;
  worker_goal?: string;
  run_root?: string;
  base?: {
    mode?: string;
    ref?: string;
  };
  worktree_setup?: WorktreeSetup;
  verification?: {
    commands?: string[];
  };
  execution?: {
    parallel?: boolean;
    worker_timeout_min?: number;
    idle_timeout_min?: number;
    timeout_grace_min?: number;
    poll_interval_sec?: number;
  };
  candidates: Candidate[];
};

export type Candidate = {
  id: string;
  harness: string;
  launch_mode?: "prompt-exec" | "interactive-tmux";
  command?: string;
  provider_profile?: string;
  model?: string;
  env_file?: string;
  required_env?: string[];
  env?: Record<string, string>;
  command_profile?: string;
  runtime?: string;
  skills?: string[];
  worktree_setup?: WorktreeSetup;
  timeout_min?: number;
  idle_timeout_min?: number;
  timeout_grace_min?: number;
};

export type WorktreeSetup = {
  commands?: WorktreeSetupCommand[];
};

export type WorktreeSetupCommand =
  | string
  | {
      id?: string;
      command: string;
      artifact?: string;
      artifact_stream?: "stdout" | "stderr" | "combined";
      required?: boolean;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseManifestText = (text: string): Manifest => {
  const parsed = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error("manifest must be an object");
  }
  return parsed as Manifest;
};

export const normalizeManifest = (manifest: Manifest, manifestPath: string, runRootOverride?: string): Manifest => {
  const manifestDir = dirname(resolve(manifestPath));
  if (manifest.schema !== SCHEMA) {
    throw new Error(`unsupported manifest schema: ${manifest.schema}`);
  }
  if (!manifest.target_repo || !manifest.plan) {
    throw new Error("manifest requires target_repo and plan");
  }
  if (!Array.isArray(manifest.candidates) || manifest.candidates.length < 2) {
    throw new Error("manifest requires at least two candidates");
  }

  const targetRepo = resolvePath(manifest.target_repo, manifestDir);
  const planPath = resolvePath(manifest.plan, targetRepo);
  const runRoot = resolvePath(runRootOverride ?? manifest.run_root ?? defaultRunRoot(targetRepo), manifestDir);
  const seen = new Set<string>();
  const candidates = manifest.candidates.map((candidate) => normalizeCandidate(candidate, seen));

  return {
    ...manifest,
    target_repo: targetRepo,
    plan: planPath,
    run_root: runRoot,
    base: {
      mode: manifest.base?.mode ?? "clean-head",
      ref: manifest.base?.ref ?? "HEAD",
    },
    verification: {
      commands: manifest.verification?.commands ?? [],
    },
    worktree_setup: normalizeWorktreeSetup(manifest.worktree_setup),
    execution: {
      parallel: manifest.execution?.parallel ?? true,
      worker_timeout_min: manifest.execution?.worker_timeout_min ?? DEFAULT_WORKER_TIMEOUT_MIN,
      idle_timeout_min: manifest.execution?.idle_timeout_min ?? DEFAULT_IDLE_TIMEOUT_MIN,
      timeout_grace_min: manifest.execution?.timeout_grace_min ?? DEFAULT_TIMEOUT_GRACE_MIN,
      poll_interval_sec: manifest.execution?.poll_interval_sec ?? DEFAULT_POLL_INTERVAL_SEC,
    },
    candidates,
  };
};

const normalizeCandidate = (candidate: Candidate, seen: Set<string>): Candidate => {
  if (!candidate.id || !/^[A-Za-z0-9._-]+$/.test(candidate.id) || candidate.id.includes("..")) {
    throw new Error(`unsafe or missing candidate id: ${candidate.id ?? "<missing>"}`);
  }
  if (seen.has(candidate.id)) {
    throw new Error(`duplicate candidate id: ${candidate.id}`);
  }
  seen.add(candidate.id);
  const runtime = candidate.runtime ?? "host";
  if (runtime !== "host") {
    throw new Error(`unsupported runtime for ${candidate.id}: ${runtime}`);
  }
  const harness = candidate.harness ?? "fake";
  if (harness === "command" && !candidate.command?.trim()) {
    throw new Error(`candidate ${candidate.id}: command harness requires command`);
  }
  const launchMode = candidate.launch_mode ?? defaultLaunchMode(candidate);
  if (!["prompt-exec", "interactive-tmux"].includes(launchMode)) {
    throw new Error(`candidate ${candidate.id}: unsupported launch_mode ${launchMode}`);
  }
  if (launchMode === "interactive-tmux" && harness !== "claude-code") {
    throw new Error(`candidate ${candidate.id}: interactive-tmux launch_mode supports claude-code only`);
  }
  return {
    ...candidate,
    harness,
    launch_mode: launchMode,
    required_env: candidate.required_env ?? [],
    runtime,
    skills: candidate.skills ?? [],
    worktree_setup: normalizeWorktreeSetup(candidate.worktree_setup),
  };
};

const defaultLaunchMode = (candidate: Candidate): "prompt-exec" | "interactive-tmux" =>
  candidate.harness === "claude-code" ? "interactive-tmux" : "prompt-exec";

const normalizeWorktreeSetup = (setup: WorktreeSetup | undefined): WorktreeSetup | undefined => {
  if (!setup) {
    return undefined;
  }
  if (!Array.isArray(setup.commands)) {
    return { commands: [] };
  }
  return {
    commands: setup.commands.map((command, index) => normalizeWorktreeSetupCommand(command, index)),
  };
};

const normalizeWorktreeSetupCommand = (
  command: WorktreeSetupCommand,
  index: number,
): WorktreeSetupCommand => {
  if (typeof command === "string") {
    if (!command.trim()) {
      throw new Error(`worktree_setup command ${index + 1}: command must not be empty`);
    }
    return command;
  }
  if (!isRecord(command) || typeof command.command !== "string" || !command.command.trim()) {
    throw new Error(`worktree_setup command ${index + 1}: command must be a non-empty string`);
  }
  if (command.artifact !== undefined) {
    validateArtifactPath(command.artifact, `worktree_setup command ${index + 1}`);
  }
  if (
    command.artifact_stream !== undefined
    && !["stdout", "stderr", "combined"].includes(command.artifact_stream)
  ) {
    throw new Error(
      `worktree_setup command ${index + 1}: artifact_stream must be stdout, stderr, or combined`,
    );
  }
  return {
    id: typeof command.id === "string" && command.id.trim() ? command.id.trim() : undefined,
    command: command.command,
    artifact: command.artifact,
    artifact_stream: command.artifact_stream,
    required: command.required,
  };
};

export const defaultRunRoot = (targetRepo: string): string =>
  join(process.env.XDG_CACHE_HOME ?? join(process.env.HOME ?? tmpdir(), ".cache"), "plan-bakeoff", "runs", slug(basename(targetRepo)));

export const resolvePath = (path: string, base: string): string => isAbsolute(path) ? resolve(path) : resolve(base, path);

export const validateManifest = (
  manifest: Manifest,
  env: Record<string, string | undefined> = process.env,
  options: { allowReal?: boolean } = {},
): string[] => {
  const errors: string[] = [];
  if (!existsSync(manifest.target_repo)) {
    errors.push(`target repo not found: ${manifest.target_repo}`);
  }
  if (!existsSync(manifest.plan)) {
    errors.push(`plan not found: ${manifest.plan}`);
  }
  for (const candidate of manifest.candidates) {
    if (candidate.runtime === "docker") {
      errors.push(`candidate ${candidate.id}: docker runtime is unsupported`);
    }
    if (candidate.harness !== "fake" && !options.allowReal) {
      errors.push(`candidate ${candidate.id}: real harness requires --execute-real`);
    }
    if (!["fake", "codex-cli", "claude-code", "command"].includes(candidate.harness)) {
      errors.push(`candidate ${candidate.id}: unsupported harness ${candidate.harness}`);
    }
    if (candidate.harness === "command" && !candidate.command?.trim()) {
      errors.push(`candidate ${candidate.id}: command harness requires command`);
    }
    for (const key of candidate.required_env ?? []) {
      if (!env[key]) {
        errors.push(`candidate ${candidate.id}: missing required env ${key}`);
      }
    }
  }
  return errors;
};

const PROPOSAL_TEMPLATES: Candidate[] = [
  {
    id: "codex-gpt-5.5",
    harness: "codex-cli",
    provider_profile: "codex-router-responses",
    model: "gpt-5.5",
    required_env: ["CODEX_BASE_URL", "CODEX_API_KEY"],
    env: {
      CODEX_BASE_URL: "CODEX_BASE_URL",
      CODEX_API_KEY: "CODEX_API_KEY",
    },
  },
  {
    id: "codex-gpt-5.3-codex",
    harness: "codex-cli",
    provider_profile: "codex-router-responses",
    model: "gpt-5.3-codex",
    required_env: ["CODEX_BASE_URL", "CODEX_API_KEY"],
    env: {
      CODEX_BASE_URL: "CODEX_BASE_URL",
      CODEX_API_KEY: "CODEX_API_KEY",
    },
  },
  {
    id: "codex-minimax",
    harness: "codex-cli",
    provider_profile: "minimax-responses",
    model: "MiniMax-M3",
    required_env: ["MM_API_KEY"],
    env: {
      MM_API_KEY: "MM_API_KEY",
      MM_BASE_URL: "MM_BASE_URL",
    },
  },
  {
    id: "claude-mimo-1000",
    harness: "claude-code",
    launch_mode: "interactive-tmux",
    provider_profile: "mimo-ultraspeed-anthropic",
    model: "mimo-1000",
    required_env: ["MIMO_API_KEY", "MIMO_BASE_URL"],
    env: {
      ANTHROPIC_AUTH_TOKEN: "MIMO_API_KEY",
      ANTHROPIC_BASE_URL: "MIMO_BASE_URL",
    },
  },
  {
    id: "claude-kimi",
    harness: "claude-code",
    launch_mode: "interactive-tmux",
    provider_profile: "kimi-anthropic",
    model: "kimi-k2.7-code",
    required_env: ["KIMI_API_KEY"],
    env: {
      ANTHROPIC_API_KEY: "KIMI_API_KEY",
      ANTHROPIC_BASE_URL: "KIMI_ANTHROPIC_BASE_URL",
    },
  },
  {
    id: "claude-minimax",
    harness: "claude-code",
    launch_mode: "interactive-tmux",
    provider_profile: "minimax-anthropic",
    model: "MiniMax-M3",
    required_env: ["MM_API_KEY"],
    env: {
      ANTHROPIC_AUTH_TOKEN: "MM_API_KEY",
      ANTHROPIC_BASE_URL: "MM_BASE_URL",
    },
  },
  {
    id: "claude-mimo-v2.5",
    harness: "claude-code",
    launch_mode: "interactive-tmux",
    provider_profile: "mimo-tp-anthropic",
    model: "mimo-v2.5",
    required_env: ["MIMO_TP_KEY"],
    env: {
      ANTHROPIC_API_KEY: "MIMO_TP_KEY",
      ANTHROPIC_BASE_URL: "MIMO_ANTHROPIC_BASE_URL",
    },
  },
];

export const proposeCandidates = (env: Record<string, string | undefined> = process.env): Candidate[] =>
  PROPOSAL_TEMPLATES.filter((candidate) => (candidate.required_env ?? []).every((key) => Boolean(env[key])));

export const proposalText = (manifest: Manifest, candidates: Candidate[]): string =>
  [
    "# Plan Bakeoff Proposal",
    "",
    `Target repo: ${manifest.target_repo}`,
    `Plan: ${manifest.plan}`,
    "",
    "## Proposed Candidates",
    "",
    ...(
      candidates.length
        ? candidates.map((candidate) => `- ${candidate.id}: ${candidate.harness} ${candidate.provider_profile ?? ""} ${candidate.model ?? ""}`.trim())
        : ["- none: missing required env keys for built-in candidates"]
    ),
    "",
  ].join("\n");

export const slug = (value: string): string => value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "run";

const validateArtifactPath = (artifact: string, context: string): void => {
  if (!artifact || artifact.startsWith("/") || artifact.includes("..")) {
    throw new Error(`${context}: artifact must be a relative path without '..'`);
  }
};
