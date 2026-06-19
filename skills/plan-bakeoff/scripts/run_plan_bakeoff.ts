#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

export const SCHEMA = "plan_bakeoff_manifest_v1";

const SECRET_KEY_PATTERN = /(API[_-]?KEY|TOKEN|AUTH|SECRET|PASSWORD|BASE_URL)$/i;
const SECRET_TEXT_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /(authorization:\s*bearer\s+)[^\s'"<>]+/gi,
] as RegExp[];

export type CandidateStatus =
  | "SUCCESS"
  | "PARTIAL"
  | "BLOCKED"
  | "FAILED";

export type Manifest = {
  schema: string;
  target_repo: string;
  plan: string;
  run_root?: string;
  base?: {
    mode?: string;
    ref?: string;
  };
  verification?: {
    commands?: string[];
  };
  candidates: Candidate[];
};

export type Candidate = {
  id: string;
  harness: string;
  provider_profile?: string;
  model?: string;
  env_file?: string;
  required_env?: string[];
  env?: Record<string, string>;
  command_profile?: string;
  runtime?: string;
  skills?: string[];
};

export type CandidateScorecard = {
  candidate_id: string;
  status: CandidateStatus;
  worker_status: string;
  base_ref: string;
  worktree: string;
  branch: string;
  run_dir: string;
  verification: Array<{ command: string; status: "pass" | "fail"; output: string }>;
  diff_stats: {
    files_changed: number;
    insertions: number;
    deletions: number;
  };
  route: {
    harness: string;
    provider_profile: string;
    model: string;
  };
  diagnostics: CandidateDiagnostics;
};

export type CandidateDiagnostics = {
  reason: string;
  output_tail: string;
  artifacts: Array<{ name: string; tail: string }>;
};

type Args = {
  manifest?: string;
  dryRun: boolean;
  execute: boolean;
  propose: boolean;
  runRoot?: string;
  keepWorktrees: boolean;
  envFile?: string;
  executeReal: boolean;
};

const usage = () => `usage: run_plan_bakeoff.ts --manifest <path> [--propose|--dry-run|--execute] [--run-root <dir>] [--env-file <path>] [--keep-worktrees] [--execute-real]
`;

const repoRootFromScript = (): string => resolve(dirname(import.meta.path), "..", "..", "..");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

const stripQuotes = (value: string): string => {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
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
  return {
    ...candidate,
    harness: candidate.harness ?? "fake",
    required_env: candidate.required_env ?? [],
    runtime,
    skills: candidate.skills ?? [],
  };
};

const defaultRunRoot = (targetRepo: string): string =>
  join(process.env.XDG_CACHE_HOME ?? join(process.env.HOME ?? tmpdir(), ".cache"), "plan-bakeoff", "runs", slug(basename(targetRepo)));

const resolvePath = (path: string, base: string): string => isAbsolute(path) ? resolve(path) : resolve(base, path);

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
    if (!["fake", "codex-cli", "claude-code"].includes(candidate.harness)) {
      errors.push(`candidate ${candidate.id}: unsupported harness ${candidate.harness}`);
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
    provider_profile: "mimo-tp-anthropic",
    model: "mimo-v2.5",
    required_env: ["MIMO_TP_KEY"],
    env: {
      ANTHROPIC_API_KEY: "MIMO_TP_KEY",
      ANTHROPIC_BASE_URL: "MIMO_ANTHROPIC_BASE_URL",
    },
  },
];

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

export const proposeCandidates = (env: Record<string, string | undefined> = process.env): Candidate[] =>
  PROPOSAL_TEMPLATES.filter((candidate) => (candidate.required_env ?? []).every((key) => Boolean(env[key])));

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

export const renderCandidateCommand = (
  candidate: Candidate,
  lastMessagePath: string,
  env: Record<string, string | undefined> = process.env,
): string[] => {
  if (candidate.harness === "codex-cli") {
    const provider = candidate.provider_profile ?? "codex-router-responses";
    const command = [
      "codex",
      "exec",
      "--ignore-user-config",
      "--ignore-rules",
      "--json",
      "--output-last-message",
      lastMessagePath,
      "--sandbox",
      "workspace-write",
    ];
    if (candidate.model) {
      command.push("-c", `model=${JSON.stringify(candidate.model)}`);
    }
    command.push("-c", `model_provider=${JSON.stringify(provider)}`);
    command.push("-c", `model_providers.${provider}.name=${JSON.stringify(provider)}`);
    command.push("-c", `model_providers.${provider}.base_url=${JSON.stringify(codexProviderBaseUrl(provider, env))}`);
    command.push("-c", `model_providers.${provider}.env_key=${JSON.stringify(PROVIDER_ENV_KEY[provider] ?? "CODEX_API_KEY")}`);
    command.push("-c", `model_providers.${provider}.wire_api="responses"`);
    command.push("-");
    return command;
  }
  if (candidate.harness === "claude-code") {
    const command = ["claude", "-p", "--verbose", "--output-format", "stream-json"];
    if (candidate.model) {
      command.push("--model", candidate.model);
    }
    return command;
  }
  throw new Error(`candidate ${candidate.id}: unsupported real harness ${candidate.harness}`);
};

const codexProviderBaseUrl = (provider: string, env: Record<string, string | undefined>): string => {
  const envKey = PROVIDER_BASE_URL_ENV[provider];
  return (envKey ? env[envKey] : undefined) ?? PROVIDER_BASE_URL_DEFAULT[provider] ?? env.CODEX_BASE_URL ?? "";
};

export const createRunDir = (runRoot: string, targetRepo: string): string => {
  mkdirSync(runRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return mkdtempSync(join(runRoot, `${stamp}-${slug(basename(targetRepo))}-`));
};

export const git = (cwd: string, args: string[], options: { allowFail?: boolean } = {}) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0 && !options.allowFail) {
    throw new Error(`git ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
};

export const assertCleanWorktree = (repo: string, mode: string): void => {
  if (mode === "allow-dirty-baseline") {
    return;
  }
  const status = git(repo, ["status", "--short"]).stdout.trim();
  if (status) {
    throw new Error(`target repo is dirty; use base.mode=allow-dirty-baseline only when every candidate should inherit the same baseline\n${status}`);
  }
};

export const createWorktree = (
  targetRepo: string,
  worktree: string,
  branch: string,
  ref: string,
): void => {
  mkdirSync(dirname(worktree), { recursive: true });
  git(targetRepo, ["worktree", "add", "-b", branch, worktree, ref]);
};

export const removeWorktree = (targetRepo: string, worktree: string, branch?: string): void => {
  git(targetRepo, ["worktree", "remove", "--force", worktree], { allowFail: true });
  if (branch) {
    git(targetRepo, ["branch", "-D", branch], { allowFail: true });
  }
};

export const copySkill = (skillName: string, destHome: string, sourceRoot = join(repoRootFromScript(), "skills")): void => {
  const src = join(sourceRoot, skillName);
  const dest = join(destHome, ".codex", "skills", skillName);
  if (!existsSync(join(src, "SKILL.md"))) {
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
};

const fakeAgentScript = (candidate: Candidate, dir: string): string => {
  const script = join(dir, "fake-agent.sh");
  const status = candidate.command_profile === "fake-partial" ? "PARTIAL" : candidate.command_profile === "fake-failed" ? "FAILED" : "SUCCESS";
  const summary = `${candidate.id} ${status.toLowerCase()}`;
  writeFileSync(
    script,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "cat >/dev/null",
      `printf '%s\\n' 'RESULT_STATUS: ${status}' 'SUMMARY: ${summary}' 'CHANGED_FILES: none' 'COMMITS: none' 'VERIFICATION: fake-worker' 'OPEN_DECISIONS: none' 'SKILL_BEHAVIOR_NOTES: none' 'ACCEPTANCE_EVIDENCE: fake candidate completed' 'RECOMMENDED_GOAL_REVISION: none'`,
      "",
    ].join("\n"),
  );
  chmodSync(script, 0o755);
  return script;
};

export const runSkillRunnerCandidate = (
  manifest: Manifest,
  candidate: Candidate,
  runDir: string,
  worktree: string,
  env: Record<string, string | undefined> = process.env,
  options: { allowReal?: boolean } = {},
): { runDir: string; status: CandidateStatus; workerStatus: string; output: string; diagnostics: CandidateDiagnostics } => {
  const candidateDir = join(runDir, "candidates", candidate.id);
  mkdirSync(candidateDir, { recursive: true });
  const home = join(candidateDir, "home");
  mkdirSync(home, { recursive: true });
  const codexHome = join(home, ".codex");
  mkdirSync(codexHome, { recursive: true });
  for (const skill of candidate.skills ?? []) {
    copySkill(skill, home);
  }
  if (candidate.harness !== "fake" && !options.allowReal) {
    throw new Error(`candidate ${candidate.id}: real harness requires --execute-real`);
  }
  const agentCommand = candidate.harness === "fake"
    ? fakeAgentScript(candidate, candidateDir)
    : shellQuoteCommand(renderCandidateCommand(candidate, join(candidateDir, "last-message.md"), env));
  const skillRunnerScript = join(repoRootFromScript(), "skills", "skill-runner", "scripts", "run_skill_runner.py");
  const workerRunRoot = join(candidateDir, "skill-runner-runs");
  const prompt = bakeoffPrompt(manifest, candidate);
  const result = spawnSync(
    "python3",
    [
      skillRunnerScript,
      "--agent-command",
      agentCommand,
      "--cwd",
      worktree,
      "--run-root",
      workerRunRoot,
      "--timeout-min",
      "5",
      "--idle-timeout-min",
      "1",
      "--poll-interval-sec",
      "0.1",
      "--",
      prompt,
    ],
    {
      cwd: repoRootFromScript(),
      encoding: "utf8",
      env: {
        ...env,
        ...candidateMappedEnv(candidate, env),
        HOME: home,
        CODEX_HOME: codexHome,
      },
    },
  );
  const output = redactText(`${result.stdout}\n${result.stderr}`, env);
  const workerDir = result.stdout.trim().split("\n").at(-1)?.trim() ?? "";
  const resultText = workerStatusText(workerDir, candidateDir);
  const workerStatus = parseResultStatus(resultText);
  const status = statusFromWorker(workerStatus, result.status ?? 1);
  return {
    runDir: workerDir,
    status,
    workerStatus,
    output,
    diagnostics: workerDiagnostics({
      workerDir,
      candidateDir,
      workerStatus,
      status,
      exitCode: result.status ?? 1,
      output,
      env,
    }),
  };
};

const workerStatusText = (workerDir: string, candidateDir: string): string =>
  [
    ...workerArtifactPaths(workerDir).map(([, path]) => path),
    join(candidateDir, "last-message.md"),
  ]
    .filter((path) => path && existsSync(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

const shellQuoteCommand = (command: string[]): string =>
  command.map((part) => `'${part.replace(/'/g, "'\\''")}'`).join(" ");

export const bakeoffPrompt = (manifest: Manifest, candidate: Candidate): string =>
  [
    `Implement approved plan ${manifest.plan} directly in this worktree.`,
    `Plan-bakeoff candidate: ${candidate.id}.`,
    "The approved plan is embedded below; do not read the plan path unless it exists in this worktree.",
    "",
    "```markdown",
    readFileSync(manifest.plan, "utf8").trim(),
    "```",
    "",
    "Use the accepted plan as scope. Do not delegate to skill-runner, tmux, or another coding agent.",
    "End with RESULT_STATUS: SUCCESS, PARTIAL, BLOCKED, or FAILED plus concise acceptance evidence.",
  ].join("\n");

export const parseResultStatus = (text: string): string => {
  const direct = /^\s*RESULT_STATUS:\s*(SUCCESS|PARTIAL|BLOCKED(?:_NEEDS_DECISION)?|FAILED)\b/im.exec(text);
  if (direct) {
    return direct[1].toUpperCase() === "BLOCKED_NEEDS_DECISION" ? "BLOCKED" : direct[1].toUpperCase();
  }
  const match = /-\s*Status:\s*([A-Z_]+)/.exec(text);
  return match?.[1] ?? "UNKNOWN";
};

const statusFromWorker = (workerStatus: string, exitCode: number): CandidateStatus => {
  if (workerStatus === "SUCCESS") return "SUCCESS";
  if (workerStatus === "PARTIAL") return "PARTIAL";
  if (workerStatus === "BLOCKED" || workerStatus === "BLOCKED_NEEDS_DECISION") return "BLOCKED";
  return exitCode === 0 ? "SUCCESS" : "FAILED";
};

const workerDiagnostics = ({
  workerDir,
  candidateDir,
  workerStatus,
  status,
  exitCode,
  output,
  env,
}: {
  workerDir: string;
  candidateDir: string;
  workerStatus: string;
  status: CandidateStatus;
  exitCode: number;
  output: string;
  env: Record<string, string | undefined>;
}): CandidateDiagnostics => {
  const artifacts = workerArtifactTails(workerDir, candidateDir, env);
  const resultReason = artifactReason(artifacts);
  const reason = resultReason
    || (workerStatus === "UNKNOWN" ? `no parseable worker status; exit code ${exitCode}` : "")
    || (status !== "SUCCESS" ? `worker reported RESULT_STATUS: ${workerStatus}; cli exit code ${exitCode}` : "");
  return {
    reason,
    output_tail: tail(output, 2000),
    artifacts,
  };
};

const workerArtifactTails = (
  workerDir: string,
  candidateDir: string,
  env: Record<string, string | undefined>,
): CandidateDiagnostics["artifacts"] => {
  const paths = [
    ...workerArtifactPaths(workerDir),
    ["last-message.md", join(candidateDir, "last-message.md")],
  ];
  return paths.flatMap(([name, path]) => {
    if (!path || !existsSync(path)) {
      return [];
    }
    const text = redactText(readFileSync(path, "utf8"), env).trim();
    return text ? [{ name, tail: tail(text, 2000) }] : [];
  });
};

const workerArtifactPaths = (workerDir: string): Array<[string, string]> =>
  workerDir
    ? [
        ["result.md", join(workerDir, "result.md")],
        ["eval.md", join(workerDir, "eval.md")],
        ["stderr.log", join(workerDir, "stderr.log")],
        ["pane-before-stop.log", join(workerDir, "pane-before-stop.log")],
        ["terminal.log", join(workerDir, "terminal.log")],
        ["events.jsonl", join(workerDir, "events.jsonl")],
      ]
    : [];

const artifactReason = (artifacts: CandidateDiagnostics["artifacts"]): string => {
  const result = artifacts.find((artifact) => artifact.name === "result.md")?.tail ?? "";
  const match = /-\s*Reason:\s*(.+)/.exec(result);
  return match?.[1]?.trim() ?? "";
};

const tail = (text: string, limit: number): string =>
  text.length > limit ? text.slice(-limit).trimStart() : text;

export const diffStats = (worktree: string): CandidateScorecard["diff_stats"] => {
  const result = git(worktree, ["diff", "--numstat"], { allowFail: true });
  let files = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of result.stdout.split(/\r?\n/)) {
    const [ins, del] = line.split(/\s+/);
    if (!ins || !del) continue;
    files += 1;
    insertions += Number.isFinite(Number(ins)) ? Number(ins) : 0;
    deletions += Number.isFinite(Number(del)) ? Number(del) : 0;
  }
  return { files_changed: files, insertions, deletions };
};

export const runVerification = (worktree: string, commands: string[], env: Record<string, string | undefined> = process.env) =>
  commands.map((command) => {
    const result = spawnSync("bash", ["-lc", command], {
      cwd: worktree,
      encoding: "utf8",
      env: { ...env },
    });
    return {
      command,
      status: result.status === 0 ? "pass" as const : "fail" as const,
      output: redactText(`${result.stdout}\n${result.stderr}`.slice(-4000), env),
    };
  });

export const writeScorecard = (scorecard: CandidateScorecard, candidateDir: string): void => {
  writeFileSync(join(candidateDir, "scorecard.json"), JSON.stringify(scorecard, null, 2) + "\n");
  writeFileSync(
    join(candidateDir, "scorecard.md"),
    [
      `# Candidate ${scorecard.candidate_id}`,
      "",
      `- Status: ${scorecard.status}`,
      `- Worker status: ${scorecard.worker_status}`,
      `- Worktree: ${scorecard.worktree}`,
      `- Skill-runner dir: ${scorecard.run_dir || "none"}`,
      `- Diff: ${scorecard.diff_stats.files_changed} files, +${scorecard.diff_stats.insertions}/-${scorecard.diff_stats.deletions}`,
      ...(shouldShowDiagnostics(scorecard)
        ? [`- Diagnostic reason: ${scorecard.diagnostics.reason || "none"}`]
        : []),
      "",
      "## Verification",
      "",
      ...scorecard.verification.map((item) => `- ${item.status}: \`${item.command}\``),
      ...(shouldShowDiagnostics(scorecard)
        ? [
            "",
            "## Diagnostics",
            "",
            scorecard.diagnostics.output_tail ? "### Runner Output Tail" : "",
            scorecard.diagnostics.output_tail ? fenced(scorecard.diagnostics.output_tail) : "",
            ...scorecard.diagnostics.artifacts.flatMap((artifact) => [
              `### ${artifact.name}`,
              fenced(artifact.tail),
            ]),
          ].filter(Boolean)
        : []),
      "",
    ].join("\n"),
  );
};

const shouldShowDiagnostics = (scorecard: CandidateScorecard): boolean =>
  scorecard.status !== "SUCCESS"
  || scorecard.worker_status === "UNKNOWN"
  || scorecard.verification.some((item) => item.status === "fail");

const fenced = (text: string): string => ["```text", text, "```"].join("\n");

export const rankScorecards = (scorecards: CandidateScorecard[]): CandidateScorecard[] => {
  const statusScore: Record<CandidateStatus, number> = {
    SUCCESS: 0,
    PARTIAL: 1,
    BLOCKED: 2,
    FAILED: 3,
  };
  return [...scorecards].sort((left, right) => {
    const leftFailures = left.verification.filter((item) => item.status === "fail").length;
    const rightFailures = right.verification.filter((item) => item.status === "fail").length;
    return (
      statusScore[left.status] - statusScore[right.status] ||
      leftFailures - rightFailures ||
      left.diff_stats.files_changed - right.diff_stats.files_changed ||
      left.candidate_id.localeCompare(right.candidate_id)
    );
  });
};

export const writeFinalReport = (runDir: string, scorecards: CandidateScorecard[]): void => {
  const ranked = rankScorecards(scorecards);
  const winner = ranked.find((item) => item.status === "SUCCESS");
  const mergeable = ranked.filter((item) => item.status === "PARTIAL").map((item) => item.candidate_id);
  const rejected = ranked.filter((item) => !["SUCCESS", "PARTIAL"].includes(item.status)).map((item) => item.candidate_id);
  writeFileSync(
    join(runDir, "final-report.md"),
    [
      "# Plan Bakeoff Report",
      "",
      `winner: ${winner?.candidate_id ?? "none"}`,
      `mergeable_with_fixes: ${mergeable.length ? mergeable.join(", ") : "none"}`,
      "cherry_pick_ideas: none",
      `reject: ${rejected.length ? rejected.join(", ") : "none"}`,
      "",
      "## Ranking",
      "",
      ...ranked.map((item, index) => `${index + 1}. ${item.candidate_id} - ${item.status}`),
      "",
      "## Verification Summary",
      "",
      ...ranked.map((item) => verificationSummaryLine(item)),
      "",
      "## Candidate Diagnostics",
      "",
      ...ranked.flatMap((item) => candidateDiagnosticLines(item)),
      "",
      "## Recommended Next Action",
      "",
      winner ? `Review ${winner.worktree}, then port with $intuitive-port-worktree if accepted.` : "No clean winner; inspect partial candidates.",
      "",
    ].join("\n"),
  );
};

const verificationSummaryLine = (scorecard: CandidateScorecard): string => {
  const pass = scorecard.verification.filter((item) => item.status === "pass").length;
  const fail = scorecard.verification.filter((item) => item.status === "fail").length;
  return `- ${scorecard.candidate_id}: ${pass} pass, ${fail} fail`;
};

const candidateDiagnosticLines = (scorecard: CandidateScorecard): string[] => {
  if (!shouldShowDiagnostics(scorecard)) {
    return [`- ${scorecard.candidate_id}: none`];
  }
  const artifactNames = scorecard.diagnostics.artifacts.map((artifact) => artifact.name).join(", ") || "none";
  return [
    `- ${scorecard.candidate_id}: ${scorecard.diagnostics.reason || "inspect scorecard diagnostics"} (artifacts: ${artifactNames})`,
  ];
};

export const executeBakeoff = (
  manifest: Manifest,
  options: {
    dryRun?: boolean;
    keepWorktrees?: boolean;
    env?: Record<string, string | undefined>;
    allowReal?: boolean;
  } = {},
): string => {
  const env = options.env ?? process.env;
  const runDir = createRunDir(manifest.run_root ?? defaultRunRoot(manifest.target_repo), manifest.target_repo);
  writeFileSync(join(runDir, "manifest.json"), JSON.stringify(sanitizeManifest(manifest), null, 2) + "\n");
  const baseRef = git(manifest.target_repo, ["rev-parse", manifest.base?.ref ?? "HEAD"]).stdout.trim();
  assertCleanWorktree(manifest.target_repo, manifest.base?.mode ?? "clean-head");

  if (options.dryRun) {
    writeFileSync(join(runDir, "dry-run.md"), dryRunText(manifest, baseRef));
    return runDir;
  }

  const scorecards: CandidateScorecard[] = [];
  for (const candidate of manifest.candidates) {
    if (candidate.harness !== "fake" && !options.allowReal) {
      throw new Error(`candidate ${candidate.id}: real harness requires --execute-real`);
    }
    const candidateDir = join(runDir, "candidates", candidate.id);
    const branch = `plan-bakeoff/${slug(basename(runDir))}/${candidate.id}`;
    const worktree = join(runDir, "worktrees", candidate.id);
    createWorktree(manifest.target_repo, worktree, branch, baseRef);
    try {
      const worker = runSkillRunnerCandidate(manifest, candidate, runDir, worktree, env, { allowReal: options.allowReal });
      const verification = runVerification(worktree, manifest.verification?.commands ?? [], env);
      const scorecard: CandidateScorecard = {
        candidate_id: candidate.id,
        status: verification.some((item) => item.status === "fail") && worker.status === "SUCCESS" ? "PARTIAL" : worker.status,
        worker_status: worker.workerStatus,
        base_ref: baseRef,
        worktree,
        branch,
        run_dir: worker.runDir,
        verification,
        diff_stats: diffStats(worktree),
        route: {
          harness: candidate.harness,
          provider_profile: candidate.provider_profile ?? "",
          model: candidate.model ?? "",
        },
        diagnostics: worker.diagnostics,
      };
      writeScorecard(scorecard, candidateDir);
      scorecards.push(scorecard);
    } finally {
      if (!options.keepWorktrees) {
        removeWorktree(manifest.target_repo, worktree, branch);
      }
    }
  }
  writeFinalReport(runDir, scorecards);
  return runDir;
};

const dryRunText = (manifest: Manifest, baseRef: string): string =>
  [
    "# Plan Bakeoff Dry Run",
    "",
    `Target repo: ${manifest.target_repo}`,
    `Plan: ${manifest.plan}`,
    `Base ref: ${baseRef}`,
    "",
    "## Candidates",
    "",
      ...manifest.candidates.map((candidate) => `- ${candidate.id}: ${candidate.harness} ${candidate.provider_profile ?? ""} ${candidate.model ?? ""}`.trim()),
      "",
    ].join("\n");

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

export const sanitizeManifest = (manifest: Manifest): Manifest => JSON.parse(redactText(JSON.stringify(manifest)));

const slug = (value: string): string => value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "run";

const parseArgs = (argv: string[]): Args => {
  const args: Args = { dryRun: false, execute: false, propose: false, keepWorktrees: false, executeReal: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") args.manifest = argv[++index];
    else if (arg === "--propose") args.propose = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--execute") args.execute = true;
    else if (arg === "--run-root") args.runRoot = argv[++index];
    else if (arg === "--env-file") args.envFile = argv[++index];
    else if (arg === "--keep-worktrees") args.keepWorktrees = true;
    else if (arg === "--execute-real") args.executeReal = true;
    else if (arg === "-h" || arg === "--help") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!args.manifest) {
    throw new Error("missing --manifest");
  }
  if (!args.propose && !args.dryRun && !args.execute) {
    args.propose = true;
  }
  return args;
};

const main = () => {
  const args = parseArgs(Bun.argv.slice(2));
  const manifestPath = resolve(args.manifest ?? "");
  const manifest = normalizeManifest(parseManifestText(readFileSync(manifestPath, "utf8")), manifestPath, args.runRoot);
  loadDotenv(args.envFile ? resolve(args.envFile) : join(repoRootFromScript(), ".plan-bakeoff.env"));
  for (const candidate of manifest.candidates) {
    if (candidate.env_file) {
      loadDotenv(resolvePath(candidate.env_file, manifest.target_repo));
    }
  }
  if (args.propose) {
    console.log(proposalText(manifest, proposeCandidates()));
    return;
  }
  const errors = validateManifest(manifest, process.env, { allowReal: args.executeReal });
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  const runDir = executeBakeoff(manifest, {
    dryRun: args.dryRun && !args.execute,
    keepWorktrees: args.keepWorktrees,
    allowReal: args.executeReal,
  });
  console.log(relative(process.cwd(), runDir).startsWith("..") ? runDir : relative(process.cwd(), runDir));
};

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
