#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  attemptRecordsFromComments,
  buildAttemptRecord,
  buildGoalTimeline,
  isAttemptStatus,
  nextAttemptSequence,
} from "./track_goal_attempts";
import type {
  AttemptStatus,
  GoalAttemptRecord,
} from "./track_goal_attempts";
import {
  markdownForFinalReview,
  markdownForFinish,
  markdownForPreflightIssueDescription,
  markdownForStart,
  replaceMarkedBlock,
  summaryBlock,
} from "./track_goal_markdown";

type Issue = {
  identifier?: string;
  id?: string;
  workspace_id?: string;
  workspaceId?: string;
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  updated_at?: string;
};

type JsonRecord = Record<string, unknown>;

export type GoalSummary = {
  purpose: string;
  sourcePurpose: string;
  route: string;
  sources: string[];
  proof: string;
  rawGoal: string;
};

export type MulticaWorkspace = {
  id: string;
  name: string;
  slug?: string;
};

export type SessionEvidence = {
  source: string;
  outcome: string;
  proofNote: string;
  excerpt: string;
  rawOutput: string;
  messageCount: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
};

type Options = {
  command: string;
  issue?: string;
  preflightText?: string;
  preflightFile?: string;
  runId?: string;
  goal?: string;
  goalFile?: string;
  attemptsFile?: string;
  sessionText?: string;
  sessionFile?: string;
  sessionDir?: string;
  summary?: string;
  summaryFile?: string;
  proof?: string;
  attemptStatus: AttemptStatus;
  allowManualSummary: boolean;
  allowDuplicate: boolean;
  updateDescription: boolean;
  dryRun: boolean;
  title?: string;
  issueStatus?: string;
  priority?: string;
  parent?: string;
  project?: string;
  assignee?: string;
  assigneeId?: string;
  profile?: string;
  workspaceId?: string;
};

type FinalReviewAttemptInput = {
  goal?: string;
  goalFile?: string;
  status?: AttemptStatus;
  sessionText?: string;
  sessionFile?: string;
  sessionDir?: string;
  proof?: string;
};

type FinalReviewAttempt = {
  summary: GoalSummary;
  session: SessionEvidence;
  record: GoalAttemptRecord;
};

export type PreflightContract = {
  raw: string;
  status?: string;
  taskSource?: string;
  canonicalSource?: string;
  route?: string;
  goal?: string;
  goalCommand: string;
  title: string;
};

const skillDir = dirname(dirname(new URL(import.meta.url).pathname));

function usage(): never {
  console.error(`Usage:
  track_goal.ts create-from-preflight --preflight-file preflight.md [--title "..."] [--dry-run]
  track_goal.ts start --issue MIA-40 [--goal-file goal.txt] [--update-description] [--dry-run]
  track_goal.ts finish --issue MIA-40 [--run-id <task-id>] [--session-file transcript.txt] [--session-dir <skill-runner-dir>] [--dry-run]
  track_goal.ts final-review --issue MIA-40 --attempts-file attempts.json [--dry-run]
  track_goal.ts summarize --goal-file goal.txt

Options:
  --preflight-text <text>   Inline intuitive-preflight contract for create-from-preflight.
  --preflight-file <path|- > Read intuitive-preflight contract for create-from-preflight.
  --title <text>            Override generated issue title for create-from-preflight.
  --goal <text>             Inline goal text.
  --goal-file <path|- >     Read goal text from file or stdin.
  --attempts-file <path|- > Read final-review attempts JSON from file or stdin.
  --run-id <task-id>        Use a specific Multica execution run.
  --session-text <text>     Inline real session transcript/output.
  --session-file <path|- >  Read real session transcript/output from file or stdin. Codex JSONL is reduced to real assistant output.
  --session-dir <path>      Read real skill-runner artifacts: result.md, eval.md, last-message.md, rewritten-prompt.md.
  --summary <text>          Manual finish summary, only with --allow-manual-summary.
  --summary-file <path|- >  Read manual finish summary, only with --allow-manual-summary.
  --proof <text>            Short verification/proof note for finish.
  --attempt-status <status> Status for this goal attempt: complete, partial, blocked, failed. Default: complete.
  --allow-manual-summary    Permit manual summary fallback when no session history exists.
  --allow-duplicate         Forward to multica issue create for create-from-preflight.
  --update-description      Insert/replace the tracker summary block in the issue description.
  --status <status>         Initial issue status for create-from-preflight.
  --priority <priority>     Initial issue priority for create-from-preflight.
  --parent <issue-id>       Parent issue for create-from-preflight.
  --project <project-id>    Project id for create-from-preflight.
  --assignee <name>         Assignee for create-from-preflight.
  --assignee-id <uuid>      Assignee id for create-from-preflight.
  --profile <name>          Forward a Multica profile.
  --workspace-id <id>       Forward a Multica workspace id or slug.
  --dry-run                 Print and render locally without writing to Multica.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const command = argv.shift();
  if (!command || !["create-from-preflight", "start", "finish", "final-review", "summarize"].includes(command)) usage();

  const opts: Options = { command, attemptStatus: "complete", allowManualSummary: false, allowDuplicate: false, updateDescription: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) usage();
      return value;
    };
    switch (arg) {
      case "--issue":
        opts.issue = next();
        break;
      case "--preflight-text":
        opts.preflightText = next();
        break;
      case "--preflight-file":
        opts.preflightFile = next();
        break;
      case "--run-id":
        opts.runId = next();
        break;
      case "--title":
        opts.title = next();
        break;
      case "--goal":
        opts.goal = next();
        break;
      case "--goal-file":
        opts.goalFile = next();
        break;
      case "--attempts-file":
        opts.attemptsFile = next();
        break;
      case "--session-text":
        opts.sessionText = next();
        break;
      case "--session-file":
        opts.sessionFile = next();
        break;
      case "--session-dir":
        opts.sessionDir = next();
        break;
      case "--summary":
        opts.summary = next();
        break;
      case "--summary-file":
        opts.summaryFile = next();
        break;
      case "--proof":
        opts.proof = next();
        break;
      case "--attempt-status": {
        const value = next();
        if (!isAttemptStatus(value)) {
          console.error(`Invalid --attempt-status: ${value}`);
          usage();
        }
        opts.attemptStatus = value;
        break;
      }
      case "--allow-manual-summary":
        opts.allowManualSummary = true;
        break;
      case "--allow-duplicate":
        opts.allowDuplicate = true;
        break;
      case "--update-description":
        opts.updateDescription = true;
        break;
      case "--status":
        opts.issueStatus = next();
        break;
      case "--priority":
        opts.priority = next();
        break;
      case "--parent":
        opts.parent = next();
        break;
      case "--project":
        opts.project = next();
        break;
      case "--assignee":
        opts.assignee = next();
        break;
      case "--assignee-id":
        opts.assigneeId = next();
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--profile":
        opts.profile = next();
        break;
      case "--workspace-id":
        opts.workspaceId = next();
        break;
      case "-h":
      case "--help":
        usage();
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        usage();
    }
  }

  if (!["summarize", "create-from-preflight"].includes(opts.command) && !opts.issue) {
    console.error("--issue is required");
    usage();
  }
  if (opts.command === "create-from-preflight" && !opts.preflightFile && !opts.preflightText) {
    console.error("--preflight-file or --preflight-text is required for create-from-preflight");
    usage();
  }
  if (opts.command === "final-review" && !opts.attemptsFile) {
    console.error("--attempts-file is required for final-review");
    usage();
  }
  return opts;
}

function readInput(inline?: string, file?: string): string {
  if (inline !== undefined) return inline;
  if (!file) return "";
  if (file === "-") return readFileSync(0, "utf8");
  return readFileSync(file, "utf8");
}

export function multicaEnv(opts: Options): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${homedir()}/.local/bin:${process.env.PATH ?? ""}` };
  if (opts.workspaceId) {
    env.MULTICA_WORKSPACE_ID = opts.workspaceId;
  }
  return env;
}

function runMultica(opts: Options, args: string[], input?: string): string {
  const globalArgs: string[] = [];
  if (opts.profile) globalArgs.push("--profile", opts.profile);
  if (opts.workspaceId) globalArgs.push("--workspace-id", opts.workspaceId);

  const result = spawnSync("multica", [...globalArgs, ...args], {
    input,
    encoding: "utf8",
    env: multicaEnv(opts),
  });
  if (result.error) {
    throw new Error(`failed to run multica: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`multica ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function runMulticaGlobal(opts: Options, args: string[], input?: string): string {
  const globalArgs: string[] = [];
  if (opts.profile) globalArgs.push("--profile", opts.profile);

  const result = spawnSync("multica", [...globalArgs, ...args], {
    input,
    encoding: "utf8",
    env: { ...process.env, PATH: `${homedir()}/.local/bin:${process.env.PATH ?? ""}` },
  });
  if (result.error) {
    throw new Error(`failed to run multica: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`multica ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function slugifyWorkspaceName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function workspaceTokenFromUrlOrPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const segment = url.pathname.split("/").filter(Boolean)[0];
    if (segment) return segment;
  } catch {
    // Not a URL; fall through to path/token handling.
  }

  const pathMatch = trimmed.match(/(?:^|\/)([a-z0-9][a-z0-9-]*)(?:\/(?:issues?|projects?|repos?|$)|\/?$)/i);
  if (pathMatch?.[1]) return pathMatch[1];
  return trimmed;
}

export function parseWorkspaceListOutput(output: string): MulticaWorkspace[] {
  try {
    const parsed = JSON.parse(output.trim()) as unknown;
    const items = Array.isArray(parsed) ? parsed : nestedArray(parsed, ["workspaces", "items"]);
    return items.reduce<MulticaWorkspace[]>((workspaces, item) => {
      const record = asRecord(item);
      const id = textFromUnknown(record?.id).trim();
      const name = textFromUnknown(record?.name).trim();
      const slug = textFromUnknown(record?.slug).trim();
      if (id && name) {
        workspaces.push({ id, name, slug: slug || undefined });
      }
      return workspaces;
    }, []);
  } catch {
    // Fall through to table parsing for older CLI output.
  }

  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.reduce<MulticaWorkspace[]>((workspaces, line) => {
    if (/^(?:ID\s+NAME|[*]\s*=|Tip:)/i.test(line)) return workspaces;
    const normalized = line.replace(/^\*\s*/, "");
    const columns = normalized.split(/\s{2,}/).map((column) => column.trim()).filter(Boolean);
    const [id, name, slug] = columns;
    if (id && name && /^[0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i.test(id)) {
      workspaces.push({ id, name, slug });
    }
    return workspaces;
  }, []);
}

export function resolveWorkspaceIdFromList(requested: string, workspaces: MulticaWorkspace[]): string {
  const token = workspaceTokenFromUrlOrPath(requested);
  if (!token) return "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return token;
  }

  const normalized = slugifyWorkspaceName(token);
  const matches = workspaces.filter((workspace) => {
    const name = workspace.name.trim();
    const slug = workspace.slug?.trim() ?? "";
    return (
      name.toLowerCase() === token.toLowerCase() ||
      slug.toLowerCase() === token.toLowerCase() ||
      slugifyWorkspaceName(name) === normalized ||
      slugifyWorkspaceName(slug) === normalized ||
      workspace.id.toLowerCase() === token.toLowerCase()
    );
  });

  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    throw new Error(`Ambiguous Multica workspace '${requested}'. Use the workspace UUID explicitly.`);
  }
  return "";
}

function resolveWorkspaceId(opts: Options, required: boolean): string | undefined {
  const explicit = opts.workspaceId ?? "";
  const requested = explicit || process.env.MULTICA_WORKSPACE_ID || "";

  if (!requested) {
    if (required) {
      throw new Error(
        "Multica workspace is required for create-from-preflight. Pass --workspace-id <workspace UUID|name|URL slug|workspace URL>.",
      );
    }
    return undefined;
  }

  const workspaces = parseWorkspaceListOutput(runMulticaGlobal(opts, ["workspace", "list", "--full-id", "--output", "json"]));
  const resolved = resolveWorkspaceIdFromList(requested, workspaces);
  if (!resolved) {
    const available = workspaces.map((workspace) => `${workspace.name} (${workspace.id})`).join(", ") || "none";
    throw new Error(`Could not resolve Multica workspace '${requested}'. Available workspaces: ${available}`);
  }

  if (!explicit && required) {
    throw new Error(
      "Refusing to create a preflight issue from implicit MULTICA_WORKSPACE_ID. Pass --workspace-id explicitly so the target workspace is reviewable.",
    );
  }
  return resolved;
}

function assertWorkspaceTargetAccessible(opts: Options, expectedWorkspaceId: string) {
  const out = runMultica({ ...opts, workspaceId: expectedWorkspaceId }, ["workspace", "get", "--output", "json"]);
  const workspace = asRecord(jsonFromCliOutput(out));
  const actualWorkspaceId = textFromUnknown(workspace?.id).trim();
  if (actualWorkspaceId !== expectedWorkspaceId) {
    throw new Error(
      `Resolved workspace ${expectedWorkspaceId}, but Multica CLI is operating in ${actualWorkspaceId || "unknown workspace"}. Refusing to create a tracker issue in the wrong workspace.`,
    );
  }
}

function getIssue(opts: Options): Issue {
  const out = runMultica(opts, ["issue", "get", opts.issue!, "--output", "json"]);
  return JSON.parse(out) as Issue;
}

function issueIdentifierFromCreateOutput(output: string): string | undefined {
  const parsed = jsonFromCliOutput(output);
  const record = asRecord(parsed);
  if (!record) return undefined;
  return textFromUnknown(record.identifier ?? record.key ?? record.id) || undefined;
}

export function issueWorkspaceIdFromCreateOutput(output: string): string | undefined {
  const parsed = jsonFromCliOutput(output);
  const record = asRecord(parsed);
  if (!record) return undefined;
  return textFromUnknown(record.workspace_id ?? record.workspaceId) || undefined;
}

function assertIssueWorkspace(issue: Issue, expectedWorkspaceId: string, context: string) {
  const actualWorkspaceId = issue.workspace_id ?? issue.workspaceId;
  if (actualWorkspaceId && actualWorkspaceId !== expectedWorkspaceId) {
    throw new Error(
      `${context} belongs to workspace ${actualWorkspaceId}, but tracker target was ${expectedWorkspaceId}. Refusing to continue in the wrong workspace.`,
    );
  }
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : undefined;
}

export function nestedArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  for (const key of keys) {
    const child = record[key];
    if (Array.isArray(child)) return child;
  }
  return [];
}

export function textFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(textFromUnknown).filter(Boolean).join("\n");
  }
  const record = asRecord(value);
  if (!record) return "";
  for (const key of ["text", "content", "message", "summary", "output", "result"]) {
    const text = textFromUnknown(record[key]);
    if (text) return text;
  }
  return JSON.stringify(value);
}

export function runIdFromRun(run: unknown): string {
  const record = asRecord(run);
  if (!record) return "";
  for (const key of ["id", "task_id", "taskId", "run_id", "runId"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function timestampFromRecord(value: unknown): number | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  for (const key of ["updated_at", "updatedAt", "created_at", "createdAt", "started_at", "startedAt", "completed_at", "completedAt"]) {
    const value = record[key];
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }
  return undefined;
}

export function selectLatestRunId(runs: unknown[]): string | undefined {
  let selected: { id: string; timestamp?: number; index: number } | undefined;
  for (const [index, run] of runs.entries()) {
    const id = runIdFromRun(run);
    if (!id) {
      continue;
    }
    const timestamp = timestampFromRecord(run);
    if (!selected) {
      selected = { id, timestamp, index };
      continue;
    }
    if (timestamp !== undefined && (selected.timestamp === undefined || timestamp > selected.timestamp)) {
      selected = { id, timestamp, index };
      continue;
    }
    if (timestamp === undefined && selected.timestamp === undefined && index > selected.index) {
      selected = { id, index };
    }
  }
  return selected?.id;
}

function getIssueRuns(opts: Options): unknown[] {
  const out = runMultica(opts, ["issue", "runs", opts.issue!, "--output", "json"]);
  return nestedArray(JSON.parse(out) as unknown, ["runs", "tasks", "executions"]);
}

function getLatestRunId(opts: Options): string | undefined {
  if (opts.runId) return opts.runId;
  return selectLatestRunId(getIssueRuns(opts));
}

function getRunMessages(opts: Options, runId: string): unknown[] {
  const out = runMultica(opts, ["issue", "run-messages", runId, "--issue", opts.issue!, "--output", "json"]);
  return nestedArray(JSON.parse(out) as unknown, ["messages", "items", "events"]);
}

export function normalizeTranscript(text: string): string {
  return text
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .join("\n")
    .trim();
}

export function pickOutcomeFromTranscript(transcript: string): string {
  const lines = transcript.split("\n").map((line) => line.trim()).filter(Boolean);
  const isStatusLine = (line: string) =>
    /RESULT_STATUS\s*[:=]|^(?:[-*]\s*)?Status\s*:\s*(?:SUCCESS|PARTIAL|BLOCKED|FAILED)\b/i.test(line);
  const summaryStart = lines.findIndex((line) =>
    /^(已完成|完成|done\.?$|completed\b|implemented\b|ran\b|decision\b|summary\b|结论[:：]|当前状态[:：])/i.test(line),
  );
  if (summaryStart >= 0) {
    const start = summaryStart > 0 && isStatusLine(lines[summaryStart - 1] ?? "") ? summaryStart - 1 : summaryStart;
    const window = lines.slice(start, summaryStart + 4);
    const detailWindow = window.filter((line, index) => !(index === 0 && /^done\.?$/i.test(line)));
    return truncate((detailWindow.length ? detailWindow : window).join(" "), 320);
  }

  const resultIndex = [...lines].reverse().findIndex(isStatusLine);
  if (resultIndex >= 0) {
    const realIndex = lines.length - 1 - resultIndex;
    return truncate(lines.slice(Math.max(0, realIndex - 2), realIndex + 3).join(" "), 260);
  }

  return truncate(lines.slice(0, 5).join(" "), 320);
}

export function sessionEvidenceFromTranscript(source: string, transcript: string, proofOverride?: string): SessionEvidence {
  const normalized = normalizeTranscript(transcript);
  if (!normalized) throw new Error(`Session evidence source '${source}' was empty.`);
  return {
    source,
    outcome: pickOutcomeFromTranscript(normalized),
    proofNote: proofOverride || "来自真实 session transcript/output。",
    excerpt: truncate(normalized.slice(Math.max(0, normalized.length - 1800)), 900),
    rawOutput: normalized,
    messageCount: normalized.split("\n").length,
  };
}

type CodexCandidate = {
  text: string;
  timestampMs?: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  turnId?: string;
};

type SessionTiming = Pick<SessionEvidence, "startedAt" | "completedAt" | "durationMs"> & {
  timestampMs?: number;
  turnId?: string;
  objective?: string;
};

type SelectedCodexEvidence = {
  candidate: CodexCandidate;
  goal?: SessionTiming;
};

class CodexGoalMatchError extends Error {}

function isoFromEpochSeconds(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return new Date(value * 1000).toISOString();
}

function timestampMsFromRecord(value: unknown): number | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const timestamp = record.timestamp;
  if (typeof timestamp !== "string") return undefined;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function durationMsFromSeconds(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value * 1000));
}

function isCodexTerminalGoalStatus(value: string): boolean {
  return value === "complete" || value === "blocked" || value === "failed" || value === "partial";
}

function timingFromCompletedTask(payload: JsonRecord, timestampMs?: number): SessionTiming {
  const completedAt = isoFromEpochSeconds(payload.completed_at) ?? (timestampMs !== undefined ? new Date(timestampMs).toISOString() : undefined);
  const durationMs = typeof payload.duration_ms === "number" && Number.isFinite(payload.duration_ms) ? Math.max(0, Math.round(payload.duration_ms)) : undefined;
  const startedAt =
    completedAt && durationMs !== undefined
      ? new Date(new Date(completedAt).getTime() - durationMs).toISOString()
      : undefined;
  return { startedAt, completedAt, durationMs };
}

function goalAccountingDurationMs(message: string): number | undefined {
  const match = message.match(/(?:final\s+)?goal accounting:\s*(?:time used\s*)?`?([0-9]+(?:\.[0-9]+)?)`?\s*(?:seconds?|secs?|s)\b/i);
  if (!match) return undefined;
  const seconds = Number.parseFloat(match[1]);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return Math.round(seconds * 1000);
}

function timingWithMessageAccounting(timing: SessionTiming, message: string, timestampMs?: number): SessionTiming {
  const durationMs = goalAccountingDurationMs(message);
  if (durationMs === undefined) return timing;
  const completedAt = timing.completedAt ?? (timestampMs !== undefined ? new Date(timestampMs).toISOString() : undefined);
  const startedAt = completedAt ? new Date(new Date(completedAt).getTime() - durationMs).toISOString() : timing.startedAt;
  return { ...timing, startedAt, completedAt, durationMs };
}

function isCompletionLikeMessage(message: string): boolean {
  return /RESULT_STATUS|^SUMMARY:|CHANGED_FILES:|VERIFICATION:|^Implemented\.|^Committed\b/im.test(message);
}

function normalizedGoalMatchTokens(goal: string): string[] {
  return normalizeLines(goal)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9_\-./$]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function goalSimilarityScore(targetGoal: string, candidateGoal: string): number {
  const target = new Set(normalizedGoalMatchTokens(targetGoal));
  const candidate = new Set(normalizedGoalMatchTokens(candidateGoal));
  if (target.size === 0 || candidate.size === 0) return 0;

  let overlap = 0;
  for (const token of target) {
    if (candidate.has(token)) overlap += 1;
  }
  const union = new Set([...target, ...candidate]).size;
  return union === 0 ? 0 : overlap / union;
}

function selectTerminalGoal(terminalGoals: SessionTiming[], targetGoal?: string): SessionTiming | undefined {
  if (terminalGoals.length === 0) return undefined;
  if (!targetGoal?.trim()) {
    if (terminalGoals.length === 1) return terminalGoals[0];
    throw new CodexGoalMatchError(
      `Codex session contains ${terminalGoals.length} terminal goals. Pass --goal/--goal-file or add a tracker start comment so the skill can select the correct goal without guessing.`,
    );
  }

  let best: { goal: SessionTiming; score: number } | undefined;
  for (const goal of terminalGoals) {
    const score = goalSimilarityScore(targetGoal, goal.objective ?? "");
    if (!best || score > best.score) {
      best = { goal, score };
    }
  }

  if (best && best.score >= 0.45) return best.goal;
  throw new CodexGoalMatchError(
    `No terminal Codex goal matched the issue goal closely enough. Pass the exact follow-up goal with --goal/--goal-file or use the matching session file.`,
  );
}

function selectCodexEvidence(candidates: CodexCandidate[], terminalGoals: SessionTiming[], targetGoal?: string): SelectedCodexEvidence | undefined {
  if (candidates.length === 0) return undefined;
  if (terminalGoals.length === 0) {
    const completion = [...candidates].reverse().find((candidate) => isCompletionLikeMessage(candidate.text));
    if (completion) return { candidate: completion };
    if (candidates.length === 1) return { candidate: candidates[0] };
    throw new CodexGoalMatchError("Codex JSONL has multiple assistant outputs but no terminal goal metadata; pass a session transcript with the exact attempt output.");
  }
  const goal = selectTerminalGoal(terminalGoals, targetGoal);
  if (!goal) return undefined;
  if (goal.turnId) {
    const sameTurn = candidates.filter((candidate) => candidate.turnId === goal.turnId);
    const sameTurnCompletion = sameTurn.filter((candidate) => isCompletionLikeMessage(candidate.text));
    if (sameTurnCompletion.length) return { candidate: sameTurnCompletion[sameTurnCompletion.length - 1], goal };
    if (sameTurn.length) return { candidate: sameTurn[sameTurn.length - 1], goal };
  }

  if (goal?.completedAt) {
    const completedMs = Date.parse(goal.completedAt);
    if (Number.isFinite(completedMs)) {
      const nearby = candidates.filter(
        (candidate) =>
          candidate.timestampMs !== undefined &&
          candidate.timestampMs >= completedMs - 60_000 &&
          candidate.timestampMs <= completedMs + 5 * 60_000 &&
          isCompletionLikeMessage(candidate.text),
      );
      if (nearby.length) return { candidate: nearby[nearby.length - 1], goal };
    }
  }

  if (terminalGoals.length > 1 || targetGoal?.trim()) {
    throw new CodexGoalMatchError("Matched Codex goal did not have an assistant attempt output in the same turn.");
  }

  const onlyGoal = terminalGoals[0];
  const sameTurn = onlyGoal.turnId ? candidates.filter((candidate) => candidate.turnId === onlyGoal.turnId) : [];
  if (sameTurn.length) return { candidate: sameTurn[sameTurn.length - 1], goal: onlyGoal };

  const singleCandidate = candidates.length === 1 ? candidates[0] : undefined;
  if (singleCandidate) return { candidate: singleCandidate, goal: onlyGoal };

  throw new CodexGoalMatchError("Could not identify a real assistant attempt output for the Codex goal.");
}

function nearestGoalTiming(terminalGoals: SessionTiming[], selected?: CodexCandidate, preferredGoal?: SessionTiming): SessionTiming {
  if (preferredGoal) {
    return {
      startedAt: preferredGoal.startedAt,
      completedAt: preferredGoal.completedAt,
      durationMs: preferredGoal.durationMs,
      turnId: preferredGoal.turnId,
      objective: preferredGoal.objective,
    };
  }

  if (terminalGoals.length === 0) {
    return {
      startedAt: selected?.startedAt,
      completedAt: selected?.completedAt,
      durationMs: selected?.durationMs,
    };
  }

  if (selected?.turnId) {
    const sameTurn = [...terminalGoals].reverse().find((goal) => goal.turnId === selected.turnId);
    if (sameTurn) {
      return { startedAt: sameTurn.startedAt, completedAt: sameTurn.completedAt, durationMs: sameTurn.durationMs };
    }
  }

  if (selected?.timestampMs === undefined) {
    const latest = terminalGoals[terminalGoals.length - 1];
    return { startedAt: latest.startedAt, completedAt: latest.completedAt, durationMs: latest.durationMs };
  }

  const selectedGoal = [...terminalGoals].reverse().find((goal) => {
    if (goal.timestampMs === undefined) return false;
    return goal.timestampMs >= selected.timestampMs! - 60_000 && goal.timestampMs <= selected.timestampMs! + 5 * 60_000;
  });
  if (!selectedGoal) {
    return {
      startedAt: selected.startedAt,
      completedAt: selected.completedAt,
      durationMs: selected.durationMs,
    };
  }

  return {
    startedAt: selectedGoal.startedAt ?? selected?.startedAt,
    completedAt: selectedGoal.completedAt ?? selected?.completedAt,
    durationMs: selectedGoal.durationMs ?? selected?.durationMs,
  };
}

function maybeParseJsonLine(line: string): JsonRecord | undefined {
  try {
    return asRecord(JSON.parse(line) as unknown);
  } catch {
    return undefined;
  }
}

function codexMessageText(value: unknown): string {
  const record = asRecord(value);
  if (!record) return "";
  const content = record.content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        const itemRecord = asRecord(item);
        if (!itemRecord) return "";
        if (itemRecord.type === "output_text" || itemRecord.type === "text") {
          return textFromUnknown(itemRecord.text);
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return textFromUnknown(content);
}

export function evidenceFromCodexJsonl(raw: string, targetGoal?: string): (SessionTiming & { transcript: string }) | undefined {
  const candidates: CodexCandidate[] = [];
  const terminalGoals: SessionTiming[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const parsed = maybeParseJsonLine(line.trim());
    if (!parsed) continue;

    const type = parsed.type;
    const payload = asRecord(parsed.payload);
    if (!payload) continue;
    const timestampMs = timestampMsFromRecord(parsed);
    const turnId = textFromUnknown(payload.turn_id ?? payload.turnId) || undefined;

    if (type === "response_item") {
      if (payload.type !== "message" || payload.role !== "assistant") continue;
      const text = codexMessageText(payload).trim();
      if (text) candidates.push({ text, timestampMs });
      continue;
    }

    if (type === "event_msg") {
      if (payload.type === "agent_message") {
        const message = textFromUnknown(payload.message).trim();
        if (message) candidates.push({ text: message, timestampMs, turnId });
      }
      if (payload.type === "task_complete") {
        const message = textFromUnknown(payload.last_agent_message).trim();
        if (message) {
          candidates.push({ text: message, timestampMs, turnId, ...timingWithMessageAccounting(timingFromCompletedTask(payload, timestampMs), message, timestampMs) });
        }
      }
      if (payload.type === "thread_goal_updated") {
        const goal = asRecord(payload.goal);
        if (!goal) continue;
        const status = textFromUnknown(goal.status);
        if (isCodexTerminalGoalStatus(status)) {
          terminalGoals.push({
            startedAt: isoFromEpochSeconds(goal.createdAt),
            completedAt: isoFromEpochSeconds(goal.updatedAt),
            durationMs: durationMsFromSeconds(goal.timeUsedSeconds),
            timestampMs,
            turnId: textFromUnknown(payload.turnId ?? payload.turn_id) || undefined,
            objective: textFromUnknown(goal.objective),
          });
        }
      }
    }
  }

  const selected = selectCodexEvidence(candidates.filter((candidate) => candidate.text.trim()), terminalGoals, targetGoal);
  if (!selected) return undefined;
  return {
    transcript: selected.candidate.text.trim(),
    ...nearestGoalTiming(terminalGoals, selected.candidate, selected.goal),
  };
}

function looksLikeCodexJsonl(text: string): boolean {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 20);
  if (lines.length === 0) return false;
  return lines.some((line) => {
    const parsed = maybeParseJsonLine(line);
    if (!parsed) return false;
    const payload = asRecord(parsed.payload);
    return typeof parsed.type === "string" && Boolean(payload);
  });
}

export function sessionEvidenceFromSessionText(source: string, text: string, proofOverride?: string, targetGoal?: string): SessionEvidence {
  if (looksLikeCodexJsonl(text)) {
    const codexEvidence = evidenceFromCodexJsonl(text, targetGoal);
    if (codexEvidence) {
      return {
        ...sessionEvidenceFromTranscript(
          `codex session ${source}`,
          codexEvidence.transcript,
          proofOverride || "从真实 Codex session assistant 输出中提取。",
        ),
        startedAt: codexEvidence.startedAt,
        completedAt: codexEvidence.completedAt,
        durationMs: codexEvidence.durationMs,
      };
    }
  }
  return sessionEvidenceFromTranscript(source, text, proofOverride);
}

function readableFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

export function transcriptFromSkillRunnerDir(dir: string): string {
  const files = ["result.md", "eval.md", "last-message.md", "rewritten-prompt.md"];
  const parts = files
    .map((name) => {
      const path = join(dir, name);
      if (!readableFile(path)) return "";
      return `# ${name}\n\n${readFileSync(path, "utf8").trim()}`;
    })
    .filter((part) => part.trim());

  if (parts.length === 0) {
    throw new Error(`No readable skill-runner evidence files found in ${dir}. Expected one of: ${files.join(", ")}`);
  }
  return parts.join("\n\n");
}

export function sessionEvidenceFromSkillRunnerDir(dir: string, proofOverride?: string): SessionEvidence {
  const transcript = transcriptFromSkillRunnerDir(dir);
  return sessionEvidenceFromTranscript(`skill-runner dir ${dir}`, transcript, proofOverride || "从真实 skill-runner result/eval artifacts 中提取。");
}

function sessionEvidenceFromRun(opts: Options, runId: string, proofOverride?: string): SessionEvidence {
  const messages = getRunMessages(opts, runId);
  const text = messages
    .map((message) => {
      const record = asRecord(message);
      const seq = record ? textFromUnknown(record.sequence ?? record.seq ?? record.index) : "";
      const role = record ? textFromUnknown(record.role ?? record.type ?? record.kind) : "";
      const body = textFromUnknown(message);
      return [seq && `#${seq}`, role && `[${role}]`, body].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join("\n");
  const evidence = sessionEvidenceFromTranscript(`multica run ${runId}`, text, proofOverride);
  return { ...evidence, messageCount: messages.length };
}

function loadSessionEvidence(opts: Options, targetGoal?: string): SessionEvidence {
  if (opts.sessionDir) {
    return sessionEvidenceFromSkillRunnerDir(opts.sessionDir, opts.proof);
  }

  const sessionText = readInput(opts.sessionText, opts.sessionFile);
  if (sessionText.trim()) {
    return sessionEvidenceFromSessionText(opts.sessionFile ? `file ${opts.sessionFile}` : "inline session text", sessionText, opts.proof, targetGoal);
  }

  const runId = getLatestRunId(opts);
  if (runId) {
    return sessionEvidenceFromRun(opts, runId, opts.proof);
  }

  if (opts.allowManualSummary) {
    const manual = readInput(opts.summary, opts.summaryFile).trim();
    if (!manual) {
      throw new Error("--allow-manual-summary requires --summary or --summary-file when no session history exists.");
    }
    return {
      source: "manual summary fallback",
      outcome: manual,
      proofNote: opts.proof || "Manual summary fallback explicitly allowed.",
      excerpt: manual,
      rawOutput: manual,
      messageCount: 0,
    };
  }

  throw new Error(
    "No Multica execution run history found for this issue. Pass --session-file with the real session transcript/output, --session-dir for a real skill-runner run directory, --run-id for a specific run, or --allow-manual-summary to use a manual summary fallback.",
  );
}

function loadSessionEvidenceFromAttemptInput(input: FinalReviewAttemptInput, targetGoal: string, index: number): SessionEvidence {
  if (input.sessionDir) {
    return sessionEvidenceFromSkillRunnerDir(input.sessionDir, input.proof);
  }
  const sessionText = readInput(input.sessionText, input.sessionFile);
  if (sessionText.trim()) {
    return sessionEvidenceFromSessionText(input.sessionFile ? `file ${input.sessionFile}` : `inline final-review attempt #${index} session text`, sessionText, input.proof, targetGoal);
  }
  throw new Error(`final-review attempt #${index} requires sessionFile, sessionText, or sessionDir.`);
}

function parseFinalReviewAttemptInput(value: unknown, index: number): FinalReviewAttemptInput {
  const record = asRecord(value);
  if (!record) throw new Error(`final-review attempt #${index} must be an object.`);
  const goal = textFromUnknown(record.goal) || undefined;
  const goalFile = textFromUnknown(record.goalFile ?? record.goal_file) || undefined;
  const statusText = textFromUnknown(record.status ?? record.attemptStatus ?? record.attempt_status) || "complete";
  if (!isAttemptStatus(statusText)) {
    throw new Error(`final-review attempt #${index} has invalid status '${statusText}'.`);
  }
  return {
    goal,
    goalFile,
    status: statusText,
    sessionText: textFromUnknown(record.sessionText ?? record.session_text) || undefined,
    sessionFile: textFromUnknown(record.sessionFile ?? record.session_file) || undefined,
    sessionDir: textFromUnknown(record.sessionDir ?? record.session_dir) || undefined,
    proof: textFromUnknown(record.proof) || undefined,
  };
}

function loadFinalReviewAttempts(opts: Options): FinalReviewAttempt[] {
  const raw = readInput(undefined, opts.attemptsFile).trim();
  if (!raw) throw new Error("--attempts-file was empty.");
  const parsed = JSON.parse(raw) as unknown;
  const values = Array.isArray(parsed) ? parsed : nestedArray(parsed, ["attempts", "items"]);
  if (values.length === 0) throw new Error("--attempts-file must be a JSON array or an object with an attempts array.");

  return values.map((value, index) => {
    const input = parseFinalReviewAttemptInput(value, index + 1);
    const goal = readInput(input.goal, input.goalFile);
    const summary = summarizeGoal(goal);
    const session = loadSessionEvidenceFromAttemptInput(input, summary.rawGoal, index + 1);
    const record = buildAttemptRecord(summary, session, input.status ?? "complete", index + 1);
    return { summary, session, record };
  });
}

function getIssueComments(opts: Options): unknown[] {
  const out = runMultica(opts, ["issue", "comment", "list", opts.issue!, "--output", "json"]);
  return nestedArray(JSON.parse(out) as unknown, ["comments", "items", "threads", "data"]);
}

function stripCodeFenceNoise(text: string): string {
  return text
    .replace(/```[a-zA-Z0-9_-]*\n/g, "")
    .replace(/```/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function extractGoal(text: string): string {
  if (!text) return "";
  const fenceMatches = [...text.matchAll(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const goalFence = fenceMatches.find((block) => /\/goal\b/.test(block));
  if (goalFence) return goalFence.trim();

  const cleaned = stripCodeFenceNoise(text);
  const idx = cleaned.search(/\/goal\b/);
  if (idx < 0) return "";
  return cleaned.slice(idx).trim();
}

export function extractTrackedGoalFromComments(comments: unknown[]): string {
  let selected: { goal: string; timestamp?: number; index: number } | undefined;
  for (const [index, comment] of comments.entries()) {
    const text = textFromUnknown(comment);
    if (!text.includes("multica-goal-tracker:start")) {
      continue;
    }
    const goal = extractGoal(text);
    if (goal) {
      const timestamp = timestampFromRecord(comment);
      if (!selected) {
        selected = { goal, timestamp, index };
        continue;
      }
      if (timestamp !== undefined && (selected.timestamp === undefined || timestamp > selected.timestamp)) {
        selected = { goal, timestamp, index };
        continue;
      }
      if (timestamp === undefined && selected.timestamp === undefined && index > selected.index) {
        selected = { goal, index };
      }
    }
  }
  return selected?.goal ?? "";
}

function resolveGoal(opts: Options, issue: Issue, allowTrackedComments: boolean): string {
  const suppliedGoal = readInput(opts.goal, opts.goalFile);
  if (suppliedGoal.trim()) {
    return suppliedGoal;
  }

  const descriptionGoal = extractGoal(issue.description ?? "");
  if (descriptionGoal) {
    return descriptionGoal;
  }

  if (!allowTrackedComments) {
    return "";
  }

  return extractTrackedGoalFromComments(getIssueComments(opts));
}

function resolveFinishGoal(opts: Options, issue: Issue, comments: unknown[]): string {
  const suppliedGoal = readInput(opts.goal, opts.goalFile);
  if (suppliedGoal.trim()) {
    return suppliedGoal;
  }

  const trackedGoal = extractTrackedGoalFromComments(comments);
  if (trackedGoal) {
    return trackedGoal;
  }

  return extractGoal(issue.description ?? "");
}

export function normalizeLines(goal: string): string[] {
  return stripCodeFenceNoise(goal)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^\/goal\b\s*/i, "").trim())
    .filter(Boolean)
    .filter((line) => !/^\$skill-runner\b/.test(line));
}

export function sentenceCaseAction(line: string): string {
  return line
    .replace(/^impl(?:ement)?\b/i, "实现")
    .replace(/^execute\b/i, "执行")
    .replace(/^fix\b/i, "修复")
    .replace(/^refactor\b/i, "重构")
    .replace(/^remove\b/i, "移除")
    .replace(/^add\b/i, "添加")
    .replace(/^create\b/i, "创建")
    .replace(/^build\b/i, "构建")
    .replace(/^run\b/i, "运行")
    .replace(/^audit\b/i, "审计")
    .replace(/^migrate\b/i, "迁移")
    .replace(/^cleanup\b|^clean up\b/i, "清理")
    .replace(/^verify\b/i, "验证")
    .replace(/^use\b/i, "使用")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeGoal(goal: string): GoalSummary {
  const lines = normalizeLines(goal);
  const rawGoal = stripCodeFenceNoise(goal);
  if (!rawGoal) throw new Error("No goal text found. Pass --goal or --goal-file.");

  const routeTokens = [...new Set([...rawGoal.matchAll(/\$[a-z][a-z0-9-]*/g)].map((m) => m[0]))];
  for (const match of rawGoal.matchAll(/\b(?:via|with)\s+([a-z][a-z0-9-]*)\b/gi)) {
    const token = match[1].toLowerCase();
    if (token.includes("-")) routeTokens.push(`$${token}`);
  }
  const route = routeTokens.length ? [...new Set(routeTokens)].join(", ") : "手动 goal";
  const sources = [...new Set([...rawGoal.matchAll(/(?:^|\s)((?:\.?\/)?(?:docs|\.planning|tasks|specs|tests|src|scripts|packages|server|web)\/[^\s`'")]+)/g)].map((m) => m[1]))];

  const proofLines = lines.filter((line) =>
    /\b(test|verify|verification|visual harness|harness|screenshot|proof|check|make sure|regression|reasonable|works)\b/i.test(line),
  );
  const actionLine =
    lines.find((line) => /\b(impl|implement|execute|fix|refactor|remove|add|create|build|run|audit|migrate|cleanup|clean up)\b/i.test(line)) ??
    lines[0] ??
    "完成请求的 goal";

  const sourcePurpose = actionLine.replace(/\s+via\s+\$[a-z0-9-]+/gi, "").trim();
  const purpose = sentenceCaseAction(sourcePurpose);
  const proof = proofLines.length ? proofLines.map(sentenceCaseAction).join(" ") : "使用 goal 中声明的验证方式或完成定义。";

  return { purpose, sourcePurpose, route, sources, proof, rawGoal };
}

function preflightField(raw: string, label: string): string {
  const lines = raw.split(/\r?\n/);
  const escaped = escapeRegExp(label);
  const start = lines.findIndex((line) => new RegExp(`^${escaped}\\s*:\\s*`, "i").test(line.trim()));
  if (start < 0) return "";

  const first = lines[start].replace(new RegExp(`^${escaped}\\s*:\\s*`, "i"), "").trim();
  const values = first ? [first] : [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^[A-Z][A-Za-z /-]{1,80}\s*:/.test(line.trim())) break;
    if (/^Approval gate\s*:/.test(line.trim())) break;
    values.push(line);
  }
  return values.join("\n").trim();
}

function fencedBlockAfterHeading(raw: string, heading: string): string {
  const headingIndex = raw.search(new RegExp(`^${escapeRegExp(heading)}\\s*:`, "im"));
  if (headingIndex < 0) return "";
  const after = raw.slice(headingIndex);
  const fence = after.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
  return fence ? fence[1].trim() : "";
}

export function extractGoalFromPreflight(raw: string): string {
  const explicitGoal = fencedBlockAfterHeading(raw, "Main-session /goal prompt");
  if (explicitGoal && /\/goal\b/.test(explicitGoal)) return explicitGoal;

  for (const field of ["Main-session /goal prompt", "To execute"]) {
    const value = preflightField(raw, field);
    if (!value) continue;
    const goal = extractGoal(value);
    if (goal) return goal;
    const line = value.split(/\r?\n/).map((candidate) => candidate.trim()).find((candidate) => /^\/goal\b/i.test(candidate));
    if (line) return line;
  }

  const canonical = preflightField(raw, "Canonical source");
  if (canonical) return `/goal execute ${canonical.split(/\r?\n/)[0].trim()} with intuitive-flow`;
  return "";
}

function titleFromCanonicalSource(canonicalSource: string): string {
  const value = canonicalSource.split(/\r?\n/)[0].trim();
  const pathMatch = value.match(/(?:^|\s)((?:docs|\.planning|tasks|specs)\/[^\s`'")]+)/);
  const source = pathMatch ? pathMatch[1] : value;
  const base = source.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? source;
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function titleFromGoalSummary(summary: GoalSummary): string {
  const source = summary.sources[0];
  if (source) return titleFromCanonicalSource(source);
  return truncate(summary.purpose.replace(/^\S+\s+/, ""), 80) || truncate(summary.purpose, 80) || "Tracked Goal";
}

export function parsePreflightContract(raw: string, titleOverride?: string): PreflightContract {
  const normalized = raw.trim();
  if (!normalized) throw new Error("Preflight input was empty.");
  const status = preflightField(normalized, "Preflight status");
  if (/BLOCKED_NEEDS_DECISION/i.test(status)) {
    throw new Error("Preflight status is BLOCKED_NEEDS_DECISION; approve or revise the contract before creating a tracked issue.");
  }
  const goalCommand = extractGoalFromPreflight(normalized);
  if (!goalCommand) {
    throw new Error("No /goal command found in preflight. Include Main-session /goal prompt or To execute.");
  }
  const summary = summarizeGoal(goalCommand);
  const canonicalSource = preflightField(normalized, "Canonical source");
  const title = titleOverride?.trim() || (canonicalSource ? titleFromCanonicalSource(canonicalSource) : titleFromGoalSummary(summary));
  return {
    raw: normalized,
    status: status || undefined,
    taskSource: preflightField(normalized, "Task source") || undefined,
    canonicalSource: canonicalSource || undefined,
    route: preflightField(normalized, "Route") || undefined,
    goal: preflightField(normalized, "Goal") || undefined,
    goalCommand: summary.rawGoal,
    title: title || "Tracked Goal",
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncate(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function artifactDir(issue: Issue): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\./g, "");
  const issueKey = issue.identifier ?? issue.id ?? "issue";
  return join(homedir(), ".cache", "multica-goal-tracker", issueKey, `${stamp}-${process.pid}`);
}

function jsonFromCliOutput(output: string): unknown {
  const trimmed = output.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // The Multica CLI can print progress lines before/after JSON even with
    // --output json.
  }

  const start = trimmed.search(/[\[{]/);
  if (start < 0) throw new Error("No JSON payload found in CLI output.");
  const opener = trimmed[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === opener) depth += 1;
    if (char === closer) depth -= 1;
    if (depth === 0) {
      return JSON.parse(trimmed.slice(start, i + 1)) as unknown;
    }
  }
  throw new Error("Unterminated JSON payload in CLI output.");
}

function writeTempMarkdown(dir: string, name: string, content: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

function printDryRun(kind: string, content: string, extra: Record<string, string> = {}) {
  console.log(`DRY RUN: ${kind}`);
  for (const [key, value] of Object.entries(extra)) {
    console.log(`${key}: ${value}`);
  }
  console.log("--- content ---");
  console.log(content);
}

function createFromPreflight(opts: Options) {
  const workspaceId = resolveWorkspaceId(opts, true);
  if (!workspaceId) {
    throw new Error("Multica workspace is required for create-from-preflight.");
  }
  const resolvedOpts = { ...opts, workspaceId };
  const preflight = readInput(opts.preflightText, opts.preflightFile);
  const contract = parsePreflightContract(preflight, opts.title);
  const summary = summarizeGoal(contract.goalCommand);
  const description = markdownForPreflightIssueDescription(contract, summary);
  const startComment = markdownForStart(summary);

  if (opts.dryRun) {
    printDryRun("issue create", description, {
      title: contract.title,
      status: opts.issueStatus ?? "default",
      priority: opts.priority ?? "default",
      parent: opts.parent ?? "",
      project: opts.project ?? "",
      assignee: opts.assignee ?? opts.assigneeId ?? "",
      allowDuplicate: String(opts.allowDuplicate),
      workspaceId: workspaceId ?? "",
    });
    printDryRun("start comment", startComment);
    return;
  }

  assertWorkspaceTargetAccessible(resolvedOpts, workspaceId);

  const dir = artifactDir({ identifier: "preflight" });
  const descriptionFile = writeTempMarkdown(dir, "preflight-issue-description.md", description);
  const args = [
    "issue",
    "create",
    "--title",
    contract.title,
    "--description-file",
    descriptionFile,
    "--output",
    "json",
  ];
  if (opts.issueStatus) args.push("--status", opts.issueStatus);
  if (opts.priority) args.push("--priority", opts.priority);
  if (opts.parent) args.push("--parent", opts.parent);
  if (opts.project) args.push("--project", opts.project);
  if (opts.assignee) args.push("--assignee", opts.assignee);
  if (opts.assigneeId) args.push("--assignee-id", opts.assigneeId);
  if (opts.allowDuplicate) args.push("--allow-duplicate");

  const out = runMultica(resolvedOpts, args);
  const issue = issueIdentifierFromCreateOutput(out);
  if (!issue) {
    throw new Error("Could not read created issue identifier from multica issue create output.");
  }
  const createdWorkspaceId = issueWorkspaceIdFromCreateOutput(out);
  if (createdWorkspaceId) {
    assertIssueWorkspace({ workspace_id: createdWorkspaceId }, workspaceId, `Created issue ${issue}`);
  } else {
    assertIssueWorkspace(getIssue({ ...resolvedOpts, issue }), workspaceId, `Created issue ${issue}`);
  }

  start({ ...resolvedOpts, goal: contract.goalCommand, goalFile: undefined, updateDescription: false, issue });
  console.log(`Created tracked preflight issue ${issue}`);
}

function start(opts: Options) {
  const issue = getIssue(opts);
  const goal = resolveGoal(opts, issue, false);
  const summary = summarizeGoal(goal);
  const comment = markdownForStart(summary);

  if (opts.dryRun) {
    printDryRun("start comment", comment);
  } else {
    const dir = artifactDir(issue);
    const commentFile = writeTempMarkdown(dir, "start-comment.md", comment);
    runMultica(opts, ["issue", "comment", "add", opts.issue!, "--content-file", commentFile, "--output", "json"]);
    console.log(`Added tracker start comment to ${issue.identifier ?? opts.issue}`);
  }

  if (opts.updateDescription) {
    const updated = replaceMarkedBlock(issue.description ?? "", summaryBlock(summary));
    if (opts.dryRun) {
      printDryRun("description update", updated);
    } else {
      const dir = artifactDir(issue);
      const descFile = writeTempMarkdown(dir, "description.md", updated);
      runMultica(opts, ["issue", "update", opts.issue!, "--description-file", descFile, "--output", "json"]);
      console.log(`Updated description for ${issue.identifier ?? opts.issue}`);
    }
  }
}

async function finish(opts: Options) {
  const issue = getIssue(opts);
  const comments = getIssueComments(opts);
  const goal = resolveFinishGoal(opts, issue, comments);
  const summary = summarizeGoal(goal);
  const session = loadSessionEvidence(opts, goal);
  const existingAttempts = attemptRecordsFromComments(comments);
  const attempt = buildAttemptRecord(summary, session, opts.attemptStatus, nextAttemptSequence(existingAttempts));
  const timeline = buildGoalTimeline([...existingAttempts, attempt]);
  const comment = markdownForFinish(issue, summary, session, attempt, timeline);

  if (opts.dryRun) {
    printDryRun("finish comment", comment);
    return;
  }

  const dir = artifactDir(issue);
  const commentFile = writeTempMarkdown(dir, "finish-comment.md", comment);
  runMultica(opts, ["issue", "comment", "add", opts.issue!, "--content-file", commentFile, "--output", "json"]);
  console.log(`Added tracker finish comment to ${issue.identifier ?? opts.issue}`);
}

async function finalReview(opts: Options) {
  const issue = getIssue(opts);
  const attempts = loadFinalReviewAttempts(opts);
  const timeline = buildGoalTimeline(attempts.map((attempt) => attempt.record));
  const finalAttempt = attempts[attempts.length - 1];
  if (!finalAttempt) throw new Error("final-review requires at least one attempt.");
  const comment = markdownForFinalReview(issue, attempts, timeline);

  if (opts.dryRun) {
    printDryRun("final-review comment", comment);
    return;
  }

  const dir = artifactDir(issue);
  const commentFile = writeTempMarkdown(dir, "final-review-comment.md", comment);
  runMultica(opts, ["issue", "comment", "add", opts.issue!, "--content-file", commentFile, "--output", "json"]);
  console.log(`Added tracker final-review comment to ${issue.identifier ?? opts.issue}`);
}

function summarize(opts: Options) {
  const goal = readInput(opts.goal, opts.goalFile);
  const summary = summarizeGoal(goal);
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  try {
    if (opts.command === "create-from-preflight") createFromPreflight(opts);
    if (opts.command === "start") start(opts);
    if (opts.command === "finish") await finish(opts);
    if (opts.command === "final-review") await finalReview(opts);
    if (opts.command === "summarize") summarize(opts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: ${message}`);
    console.error(`Skill directory: ${skillDir}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
