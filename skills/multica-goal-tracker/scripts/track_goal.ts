#!/usr/bin/env bun
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

type Issue = {
  identifier?: string;
  id?: string;
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  updated_at?: string;
};

type JsonRecord = Record<string, unknown>;

type RenderedEvidence = {
  dir: string;
  attachment: string;
  htmlPath: string;
  svgPath: string;
};

export type GoalSummary = {
  purpose: string;
  route: string;
  sources: string[];
  proof: string;
  rawGoal: string;
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

export type AttemptStatus = "complete" | "partial" | "blocked" | "failed";

export type GoalAttemptRecord = {
  sequence: number;
  status: AttemptStatus;
  goal: string;
  purpose: string;
  route: string;
  proof: string;
  source: string;
  outcome: string;
  proofNote: string;
  messageCount: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  recordedAt: string;
};

export type GoalTimeline = {
  attempts: GoalAttemptRecord[];
  totalDurationMs?: number;
  startedAt?: string;
  completedAt?: string;
};

type Options = {
  command: string;
  issue?: string;
  runId?: string;
  goal?: string;
  goalFile?: string;
  sessionText?: string;
  sessionFile?: string;
  sessionDir?: string;
  summary?: string;
  summaryFile?: string;
  proof?: string;
  attemptStatus: AttemptStatus;
  allowManualSummary: boolean;
  updateDescription: boolean;
  dryRun: boolean;
  profile?: string;
  workspaceId?: string;
};

const skillDir = dirname(dirname(new URL(import.meta.url).pathname));

function isAttemptStatus(value: string): value is AttemptStatus {
  return value === "complete" || value === "partial" || value === "blocked" || value === "failed";
}

function usage(): never {
  console.error(`Usage:
  track_goal.ts start --issue MIA-40 [--goal-file goal.txt] [--update-description] [--dry-run]
  track_goal.ts finish --issue MIA-40 [--run-id <task-id>] [--session-file transcript.txt] [--session-dir <skill-runner-dir>] [--dry-run]
  track_goal.ts summarize --goal-file goal.txt

Options:
  --goal <text>             Inline goal text.
  --goal-file <path|- >     Read goal text from file or stdin.
  --run-id <task-id>        Use a specific Multica execution run.
  --session-text <text>     Inline real session transcript/output.
  --session-file <path|- >  Read real session transcript/output from file or stdin. Codex JSONL is reduced to real assistant output.
  --session-dir <path>      Read real skill-runner artifacts: result.md, eval.md, last-message.md, rewritten-prompt.md.
  --summary <text>          Manual finish summary, only with --allow-manual-summary.
  --summary-file <path|- >  Read manual finish summary, only with --allow-manual-summary.
  --proof <text>            Short verification/proof note for finish.
  --attempt-status <status> Status for this goal attempt: complete, partial, blocked, failed. Default: complete.
  --allow-manual-summary    Permit manual summary fallback when no session history exists.
  --update-description      Insert/replace the tracker summary block in the issue description.
  --profile <name>          Forward a Multica profile.
  --workspace-id <id>       Forward a Multica workspace id or slug.
  --dry-run                 Print and render locally without writing to Multica.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const command = argv.shift();
  if (!command || !["start", "finish", "summarize"].includes(command)) usage();

  const opts: Options = { command, attemptStatus: "complete", allowManualSummary: false, updateDescription: false, dryRun: false };
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
      case "--run-id":
        opts.runId = next();
        break;
      case "--goal":
        opts.goal = next();
        break;
      case "--goal-file":
        opts.goalFile = next();
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
      case "--update-description":
        opts.updateDescription = true;
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

  if (opts.command !== "summarize" && !opts.issue) {
    console.error("--issue is required");
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

function runMultica(opts: Options, args: string[], input?: string): string {
  const globalArgs: string[] = [];
  if (opts.profile) globalArgs.push("--profile", opts.profile);
  if (opts.workspaceId) globalArgs.push("--workspace-id", opts.workspaceId);

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

function getIssue(opts: Options): Issue {
  const out = runMultica(opts, ["issue", "get", opts.issue!, "--output", "json"]);
  return JSON.parse(out) as Issue;
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
  const resultIndex = [...lines].reverse().findIndex((line) => /RESULT_STATUS|SUCCESS|PARTIAL|BLOCKED|FAILED/i.test(line));
  if (resultIndex >= 0) {
    const realIndex = lines.length - 1 - resultIndex;
    return truncate(lines.slice(Math.max(0, realIndex - 2), realIndex + 3).join(" "), 260);
  }
  return truncate(lines.slice(-5).join(" "), 260);
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

function timingFromCompletedTask(payload: JsonRecord, timestampMs?: number): SessionTiming {
  const completedAt = isoFromEpochSeconds(payload.completed_at) ?? (timestampMs !== undefined ? new Date(timestampMs).toISOString() : undefined);
  const durationMs = typeof payload.duration_ms === "number" && Number.isFinite(payload.duration_ms) ? Math.max(0, Math.round(payload.duration_ms)) : undefined;
  const startedAt =
    completedAt && durationMs !== undefined
      ? new Date(new Date(completedAt).getTime() - durationMs).toISOString()
      : undefined;
  return { startedAt, completedAt, durationMs };
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

function selectCompletedGoal(completeGoals: SessionTiming[], targetGoal?: string): SessionTiming | undefined {
  if (completeGoals.length === 0) return undefined;
  if (!targetGoal?.trim()) {
    if (completeGoals.length === 1) return completeGoals[0];
    throw new CodexGoalMatchError(
      `Codex session contains ${completeGoals.length} completed goals. Pass --goal/--goal-file or add a tracker start comment so the skill can select the correct goal without guessing.`,
    );
  }

  let best: { goal: SessionTiming; score: number } | undefined;
  for (const goal of completeGoals) {
    const score = goalSimilarityScore(targetGoal, goal.objective ?? "");
    if (!best || score > best.score) {
      best = { goal, score };
    }
  }

  if (best && best.score >= 0.45) return best.goal;
  throw new CodexGoalMatchError(
    `No completed Codex goal matched the issue goal closely enough. Pass the exact follow-up goal with --goal/--goal-file or use the matching session file.`,
  );
}

function selectCodexEvidence(candidates: CodexCandidate[], completeGoals: SessionTiming[], targetGoal?: string): SelectedCodexEvidence | undefined {
  if (candidates.length === 0) return undefined;
  if (completeGoals.length === 0) {
    const completion = [...candidates].reverse().find((candidate) => isCompletionLikeMessage(candidate.text));
    if (completion) return { candidate: completion };
    if (candidates.length === 1) return { candidate: candidates[0] };
    throw new CodexGoalMatchError("Codex JSONL has multiple assistant outputs but no goal completion metadata; pass a session transcript with the exact completion output.");
  }
  const goal = selectCompletedGoal(completeGoals, targetGoal);
  if (goal?.turnId) {
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

  if (completeGoals.length > 1 || targetGoal?.trim()) {
    throw new CodexGoalMatchError("Matched Codex goal did not have an assistant completion output in the same turn.");
  }

  const onlyGoal = completeGoals[0];
  const sameTurn = onlyGoal?.turnId ? candidates.filter((candidate) => candidate.turnId === onlyGoal.turnId) : [];
  if (sameTurn.length) return { candidate: sameTurn[sameTurn.length - 1], goal: onlyGoal };

  const singleCandidate = candidates.length === 1 ? candidates[0] : undefined;
  if (singleCandidate) return { candidate: singleCandidate, goal: onlyGoal };

  throw new CodexGoalMatchError("Could not identify a real assistant completion output for the Codex goal.");
}

function nearestGoalTiming(completeGoals: SessionTiming[], selected?: CodexCandidate, preferredGoal?: SessionTiming): SessionTiming {
  if (preferredGoal) {
    return {
      startedAt: preferredGoal.startedAt,
      completedAt: preferredGoal.completedAt,
      durationMs: preferredGoal.durationMs,
      turnId: preferredGoal.turnId,
      objective: preferredGoal.objective,
    };
  }

  if (completeGoals.length === 0) {
    return {
      startedAt: selected?.startedAt,
      completedAt: selected?.completedAt,
      durationMs: selected?.durationMs,
    };
  }

  if (selected?.turnId) {
    const sameTurn = [...completeGoals].reverse().find((goal) => goal.turnId === selected.turnId);
    if (sameTurn) {
      return { startedAt: sameTurn.startedAt, completedAt: sameTurn.completedAt, durationMs: sameTurn.durationMs };
    }
  }

  if (selected?.timestampMs === undefined) {
    const latest = completeGoals[completeGoals.length - 1];
    return { startedAt: latest.startedAt, completedAt: latest.completedAt, durationMs: latest.durationMs };
  }

  const selectedGoal = [...completeGoals].reverse().find((goal) => {
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
  const completeGoals: SessionTiming[] = [];

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
        if (message) candidates.push({ text: message, timestampMs, turnId, ...timingFromCompletedTask(payload, timestampMs) });
      }
      if (payload.type === "thread_goal_updated") {
        const goal = asRecord(payload.goal);
        if (goal?.status === "complete") {
          completeGoals.push({
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

  const selected = selectCodexEvidence(candidates.filter((candidate) => candidate.text.trim()), completeGoals, targetGoal);
  if (!selected) return undefined;
  return {
    transcript: selected.candidate.text.trim(),
    ...nearestGoalTiming(completeGoals, selected.candidate, selected.goal),
  };
}

export function transcriptFromCodexJsonl(raw: string, targetGoal?: string): string | undefined {
  return evidenceFromCodexJsonl(raw, targetGoal)?.transcript;
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

function getIssueComments(opts: Options): unknown[] {
  const out = runMultica(opts, ["issue", "comment", "list", opts.issue!, "--output", "json"]);
  return nestedArray(JSON.parse(out) as unknown, ["comments", "items", "threads", "data"]);
}

const attemptMetaPrefix = "<!-- multica-goal-tracker:attempt ";
const attemptMetaSuffix = " -->";
const encodedAttemptMetaPrefix = "v1:";

function parseAttemptRecord(value: unknown): GoalAttemptRecord | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const status = textFromUnknown(record.status);
  if (!isAttemptStatus(status)) return undefined;
  const sequence = typeof record.sequence === "number" && Number.isFinite(record.sequence) ? Math.max(1, Math.round(record.sequence)) : 1;
  const goal = textFromUnknown(record.goal);
  const purpose = textFromUnknown(record.purpose);
  const route = textFromUnknown(record.route);
  const proof = textFromUnknown(record.proof);
  const source = textFromUnknown(record.source);
  const outcome = textFromUnknown(record.outcome);
  const proofNote = textFromUnknown(record.proofNote);
  const recordedAt = textFromUnknown(record.recordedAt) || new Date(0).toISOString();
  const messageCount = typeof record.messageCount === "number" && Number.isFinite(record.messageCount) ? Math.max(0, Math.round(record.messageCount)) : 0;
  const durationMs = typeof record.durationMs === "number" && Number.isFinite(record.durationMs) ? Math.max(0, Math.round(record.durationMs)) : undefined;
  return {
    sequence,
    status,
    goal,
    purpose,
    route,
    proof,
    source,
    outcome,
    proofNote,
    messageCount,
    startedAt: textFromUnknown(record.startedAt) || undefined,
    completedAt: textFromUnknown(record.completedAt) || undefined,
    durationMs,
    recordedAt,
  };
}

export function attemptRecordFromCommentText(text: string): GoalAttemptRecord | undefined {
  const idx = text.indexOf(attemptMetaPrefix);
  if (idx < 0) return undefined;
  const start = idx + attemptMetaPrefix.length;
  const end = text.indexOf(attemptMetaSuffix, start);
  if (end < 0) return undefined;
  const first = parseAttemptRecordPayload(text.slice(start, end));
  if (first) return first;

  const lastEnd = text.lastIndexOf(attemptMetaSuffix);
  if (lastEnd > end) return parseAttemptRecordPayload(text.slice(start, lastEnd));
  return undefined;
}

function parseAttemptRecordPayload(payload: string): GoalAttemptRecord | undefined {
  try {
    const trimmed = payload.trim();
    const rawJson = trimmed.startsWith(encodedAttemptMetaPrefix)
      ? Buffer.from(trimmed.slice(encodedAttemptMetaPrefix.length), "base64").toString("utf8")
      : trimmed;
    return parseAttemptRecord(JSON.parse(rawJson) as unknown);
  } catch {
    return undefined;
  }
}

export function attemptRecordsFromComments(comments: unknown[]): GoalAttemptRecord[] {
  return comments
    .map((comment) => attemptRecordFromCommentText(textFromUnknown(comment)))
    .filter((record): record is GoalAttemptRecord => Boolean(record))
    .sort((a, b) => {
      const bySequence = a.sequence - b.sequence;
      if (bySequence !== 0) return bySequence;
      return Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
    });
}

function encodeAttemptRecord(record: GoalAttemptRecord): string {
  const encoded = Buffer.from(JSON.stringify(record), "utf8").toString("base64");
  return `${attemptMetaPrefix}${encodedAttemptMetaPrefix}${encoded}${attemptMetaSuffix}`;
}

export function buildAttemptRecord(summary: GoalSummary, session: SessionEvidence, status: AttemptStatus, sequence: number): GoalAttemptRecord {
  return {
    sequence,
    status,
    goal: summary.rawGoal,
    purpose: summary.purpose,
    route: summary.route,
    proof: summary.proof,
    source: session.source,
    outcome: session.outcome,
    proofNote: session.proofNote,
    messageCount: session.messageCount,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    durationMs: session.durationMs,
    recordedAt: new Date().toISOString(),
  };
}

export function buildGoalTimeline(attempts: GoalAttemptRecord[]): GoalTimeline {
  let totalDurationMs = 0;
  let hasDuration = false;
  let startedAt: string | undefined;
  let completedAt: string | undefined;
  for (const attempt of attempts) {
    if (attempt.durationMs !== undefined && Number.isFinite(attempt.durationMs)) {
      totalDurationMs += attempt.durationMs;
      hasDuration = true;
    }
    if (attempt.startedAt && (!startedAt || Date.parse(attempt.startedAt) < Date.parse(startedAt))) {
      startedAt = attempt.startedAt;
    }
    if (attempt.completedAt && (!completedAt || Date.parse(attempt.completedAt) > Date.parse(completedAt))) {
      completedAt = attempt.completedAt;
    }
  }
  return { attempts, totalDurationMs: hasDuration ? totalDurationMs : undefined, startedAt, completedAt };
}

export function nextAttemptSequence(attempts: GoalAttemptRecord[]): number {
  return attempts.reduce((max, attempt) => Math.max(max, attempt.sequence), 0) + 1;
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
  const route = routeTokens.length ? routeTokens.join(", ") : "手动 goal";
  const sources = [...new Set([...rawGoal.matchAll(/(?:^|\s)((?:\.?\/)?(?:docs|\.planning|tasks|specs|tests|src|scripts|packages|server|web)\/[^\s`'")]+)/g)].map((m) => m[1]))];

  const proofLines = lines.filter((line) =>
    /\b(test|verify|verification|visual harness|harness|screenshot|proof|check|make sure|regression|reasonable|works)\b/i.test(line),
  );
  const actionLine =
    lines.find((line) => /\b(impl|implement|execute|fix|refactor|remove|add|create|build|run|audit|migrate|cleanup|clean up)\b/i.test(line)) ??
    lines[0] ??
    "完成请求的 goal";

  const purpose = sentenceCaseAction(actionLine.replace(/\s+via\s+\$[a-z0-9-]+/gi, ""));
  const proof = proofLines.length ? proofLines.map(sentenceCaseAction).join(" ") : "使用 goal 中声明的验证方式或完成定义。";

  return { purpose, route, sources, proof, rawGoal };
}

export function markdownForStart(summary: GoalSummary): string {
  const sources = summary.sources.length ? summary.sources.map((s) => `\`${s}\``).join(", ") : "未在 goal 中明确。";
  return `<!-- multica-goal-tracker:start -->
## Goal 跟踪开始

**目标:** ${summary.purpose}

**执行入口:** ${summary.route}

**来源材料:** ${sources}

**预期验证:** ${summary.proof}

**Goal 命令:**

\`\`\`text
${summary.rawGoal}
\`\`\`
`;
}

export function summaryBlock(summary: GoalSummary): string {
  const sources = summary.sources.length ? summary.sources.map((s) => `\`${s}\``).join(", ") : "未在 goal 中明确。";
  return `<!-- multica-goal-tracker:summary:start -->
## Goal 摘要

**目标:** ${summary.purpose}

**执行入口:** ${summary.route}

**来源材料:** ${sources}

**预期验证:** ${summary.proof}
<!-- multica-goal-tracker:summary:end -->`;
}

export function replaceMarkedBlock(existing: string, block: string): string {
  const start = "<!-- multica-goal-tracker:summary:start -->";
  const end = "<!-- multica-goal-tracker:summary:end -->";
  const re = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  if (re.test(existing)) return existing.replace(re, block);
  return `${block}\n\n${existing}`.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function formatDateTime(value?: string): string {
  if (!value) return "未知";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined || !Number.isFinite(durationMs)) return "未知";
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function artifactDir(issue: Issue): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\./g, "");
  const issueKey = issue.identifier ?? issue.id ?? "issue";
  return join(homedir(), ".cache", "multica-goal-tracker", issueKey, `${stamp}-${process.pid}`);
}

function compactSessionSource(source: string): string {
  const pathMatch = source.match(/(\/[^\s]+)$/);
  if (!pathMatch) return source;
  const path = pathMatch[1];
  const prefix = source.slice(0, source.length - path.length).trim();
  const compactPath = path.split("/").filter(Boolean).slice(-4).join("/");
  return [prefix, compactPath].filter(Boolean).join(" ");
}

function renderEvidence(issue: Issue, summary: GoalSummary, session: SessionEvidence, timeline: GoalTimeline): RenderedEvidence {
  const dir = artifactDir(issue);
  mkdirSync(dir, { recursive: true });
  const htmlPath = join(dir, "completion-card.html");
  const svgPath = join(dir, "completion-card.svg");
  const pngPath = join(dir, "completion-card.png");
  const issueKey = issue.identifier ?? issue.id ?? "Issue";
  const title = issue.title ?? "";
  const status = issue.status ?? "unknown";
  const source = compactSessionSource(session.source);
  const currentAttempt = timeline.attempts[timeline.attempts.length - 1];
  const timelineRows = timeline.attempts
    .slice(-5)
    .map((attempt) => {
      const active = attempt.sequence === currentAttempt?.sequence ? " active" : "";
      return `
        <div class="attempt-row${active}">
          <div class="attempt-index">#${attempt.sequence}</div>
          <div class="attempt-main">
            <div class="attempt-title">${htmlEscape(truncate(attempt.purpose, 92))}</div>
            <div class="attempt-meta">${htmlEscape(attempt.status)} · ${htmlEscape(formatDuration(attempt.durationMs))} · ${htmlEscape(formatDateTime(attempt.completedAt))}</div>
          </div>
        </div>
      `;
    })
    .join("");

  const cardInner = `
    <div class="topline">
      <span>${htmlEscape(issueKey)}</span>
      <span>${htmlEscape(status)}</span>
    </div>
    <h1>${htmlEscape(truncate(title, 96))}</h1>
    <div class="body">
      <section class="overview">
        <div>
          <div class="label">累计耗时</div>
          <p class="stat">${htmlEscape(formatDuration(timeline.totalDurationMs))}</p>
        </div>
        <div>
          <div class="label">Goal 次数</div>
          <p class="stat">${timeline.attempts.length}</p>
        </div>
        <div>
          <div class="label">Issue 起止</div>
          <p class="meta">${htmlEscape(formatDateTime(timeline.startedAt))} - ${htmlEscape(formatDateTime(timeline.completedAt))}</p>
        </div>
      </section>
      <section>
        <div class="label">当前 Goal 目标</div>
        <p class="clamp-1">${htmlEscape(truncate(summary.purpose, 160))}</p>
      </section>
      <section>
        <div class="label">当前结果</div>
        <p class="clamp-2">${htmlEscape(truncate(session.outcome, 180))}</p>
      </section>
      <section class="timing">
        <div>
          <div class="label">当前开始</div>
          <p class="meta">${htmlEscape(formatDateTime(session.startedAt))}</p>
        </div>
        <div>
          <div class="label">当前结束</div>
          <p class="meta">${htmlEscape(formatDateTime(session.completedAt))}</p>
        </div>
        <div>
          <div class="label">当前耗时</div>
          <p class="meta">${htmlEscape(formatDuration(session.durationMs))}</p>
        </div>
      </section>
      <section class="grid">
        <div>
          <div class="label">执行入口</div>
          <p class="clamp-1">${htmlEscape(summary.route)}</p>
        </div>
        <div>
          <div class="label">Session 来源</div>
          <p class="clamp-2">${htmlEscape(truncate(source, 130))}</p>
        </div>
      </section>
      <section class="proof">
        <div class="label">验证说明</div>
        <p class="clamp-2">${htmlEscape(truncate(session.proofNote, 180))}</p>
      </section>
      <section class="timeline-list">
        <div class="label">Goal 时间线</div>
        <div class="attempts">${timelineRows}</div>
      </section>
    </div>
  `;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    width: 1400px;
    height: 900px;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f5f5f2;
    color: #151712;
  }
  .card {
    width: 1280px;
    height: 820px;
    margin: 40px 60px;
    padding: 32px 52px;
    background: #ffffff;
    border: 1px solid #d9dbd2;
    box-shadow: 0 28px 80px rgba(20, 24, 16, 0.16);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .topline {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #386641;
    font-size: 28px;
    font-weight: 720;
    letter-spacing: 0;
    text-transform: uppercase;
  }
  h1 {
    margin: 18px 0 16px;
    font-size: 44px;
    line-height: 1.06;
    letter-spacing: 0;
    max-width: 1100px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  section { margin: 0; }
  .overview {
    display: grid;
    grid-template-columns: 0.85fr 0.6fr 1.55fr;
    gap: 24px;
    padding: 12px 18px;
    border: 1px solid #dfe2d8;
    background: #f7f8f4;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 40px;
  }
  .timing {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  .label {
    color: #606656;
    font-size: 17px;
    font-weight: 720;
    letter-spacing: 0;
    margin-bottom: 4px;
  }
  p {
    margin: 0;
    color: #25291f;
    font-size: 23px;
    line-height: 1.16;
    overflow-wrap: anywhere;
  }
  .meta {
    font-size: 20px;
    line-height: 1.15;
  }
  .stat {
    font-size: 28px;
    font-weight: 720;
    line-height: 1.05;
  }
  .clamp-1,
  .clamp-2,
  .clamp-3,
  .clamp-4 {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .clamp-1 { -webkit-line-clamp: 1; }
  .clamp-2 { -webkit-line-clamp: 2; }
  .clamp-3 { -webkit-line-clamp: 3; }
  .clamp-4 { -webkit-line-clamp: 4; }
  .proof {
    min-height: 58px;
  }
  .timeline-list {
    min-height: 122px;
  }
  .attempts {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .attempt-row {
    display: grid;
    grid-template-columns: 54px 1fr;
    gap: 12px;
    align-items: center;
    min-height: 36px;
    padding: 5px 10px;
    border-left: 4px solid #b8bead;
    background: #fafaf8;
  }
  .attempt-row.active {
    border-left-color: #386641;
    background: #f1f5ee;
  }
  .attempt-index {
    color: #386641;
    font-size: 17px;
    font-weight: 720;
  }
  .attempt-title {
    color: #25291f;
    font-size: 17px;
    line-height: 1.15;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .attempt-meta {
    color: #606656;
    font-size: 14px;
    line-height: 1.15;
  }
</style>
</head>
<body><main class="card">${cardInner}</main></body>
</html>
`;
  writeFileSync(htmlPath, html);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900">
  <foreignObject width="1400" height="900">${html.replace(/<!doctype html>\n?/, "")}</foreignObject>
</svg>
`;
  writeFileSync(svgPath, svg);

  const chrome = findCommand(["google-chrome", "chromium", "chromium-browser"]);
  if (chrome) {
    const result = spawnSync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--window-size=1400,900",
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ], { encoding: "utf8" });
    if (result.status === 0 && existsSync(pngPath)) {
      return { dir, attachment: pngPath, htmlPath, svgPath };
    }
  }
  return { dir, attachment: svgPath, htmlPath, svgPath };
}

function findCommand(commands: string[]): string | undefined {
  for (const command of commands) {
    const result = spawnSync("bash", ["-lc", `command -v ${command}`], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  }
  return undefined;
}

export function markdownFenceText(value: string): string {
  return value.replace(/```/g, "\\`\\`\\`");
}

export function markdownCodeBlock(value: string, info = "text"): string {
  const longest = Math.max(0, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${info}\n${value}\n${fence}`;
}

export function markdownForFinish(
  issue: Issue,
  summary: GoalSummary,
  session: SessionEvidence,
  attachment: string,
  attempt: GoalAttemptRecord,
  timeline: GoalTimeline,
): string {
  const title = attempt.status === "complete" ? "Goal 完成记录" : "Goal 执行记录";
  return `<!-- multica-goal-tracker:finish -->
${encodeAttemptRecord(attempt)}
## ${title}

**Issue:** ${issue.identifier ?? issue.id ?? "unknown"}

**状态:** ${issue.status ?? "unknown"}

**本次 Goal:** #${attempt.sequence} / ${attempt.status}

**Session 来源:** ${session.source}

**消息数:** ${session.messageCount}

**本次开始时间:** ${formatDateTime(session.startedAt)}

**本次结束时间:** ${formatDateTime(session.completedAt)}

**本次持续时间:** ${formatDuration(session.durationMs)}

**Issue 累计耗时:** ${formatDuration(timeline.totalDurationMs)}

**Issue 时间范围:** ${formatDateTime(timeline.startedAt)} - ${formatDateTime(timeline.completedAt)}

**完成结果:** ${session.outcome}

**验证说明:** ${session.proofNote}

**证据:** 已附加渲染后的完成卡片；如果 Multica 返回附件 URL，脚本会自动追加一条内联图片回复。

**Goal 目标:** ${summary.purpose}

**Goal 时间线:** 已累计 ${timeline.attempts.length} 次 goal attempt；卡片中展示最近的 attempt 和累计耗时。

**Session 摘录:** 完整输出已在下方代码块评论中保留。

本地证据文件: \`${attachment}\`
`;
}

export function markdownForRawSessionOutput(session: SessionEvidence): string {
  return `<!-- multica-goal-tracker:raw-session-output -->
## 真实 session 完成输出

**Session 来源:** ${session.source}

**开始时间:** ${formatDateTime(session.startedAt)}

**结束时间:** ${formatDateTime(session.completedAt)}

**持续时间:** ${formatDuration(session.durationMs)}

${markdownCodeBlock(session.rawOutput)}
`;
}

export function markdownForInlineImage(url: string): string {
  return `<!-- multica-goal-tracker:evidence-image -->
![completion-card.png](${url})
`;
}

function findImageAttachmentUrl(value: unknown): string | undefined {
  const record = asRecord(value);
  if (record) {
    const contentType = textFromUnknown(record.content_type ?? record.contentType);
    const filename = textFromUnknown(record.filename ?? record.name);
    const url = textFromUnknown(record.url ?? record.download_url ?? record.downloadUrl);
    if (url && (/^image\//i.test(contentType) || /\.(png|jpe?g|webp|gif|svg)$/i.test(filename || url))) {
      return url;
    }
    for (const child of Object.values(record)) {
      const found = findImageAttachmentUrl(child);
      if (found) return found;
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageAttachmentUrl(item);
      if (found) return found;
    }
  }
  return undefined;
}

export function imageAttachmentUrlFromCommentOutput(output: string): string | undefined {
  if (!output.trim()) return undefined;
  try {
    return findImageAttachmentUrl(JSON.parse(output) as unknown);
  } catch {
    return undefined;
  }
}

export function commentIdFromCommentOutput(output: string): string | undefined {
  if (!output.trim()) return undefined;
  try {
    const parsed = JSON.parse(output) as unknown;
    const record = asRecord(parsed);
    const id = record ? textFromUnknown(record.id) : "";
    if (id) return id;
    const nested = record ? asRecord(record.comment ?? record.data) : undefined;
    return nested ? textFromUnknown(nested.id) || undefined : undefined;
  } catch {
    return undefined;
  }
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

function finish(opts: Options) {
  const issue = getIssue(opts);
  const comments = getIssueComments(opts);
  const goal = resolveFinishGoal(opts, issue, comments);
  const summary = summarizeGoal(goal);
  const session = loadSessionEvidence(opts, goal);
  const existingAttempts = attemptRecordsFromComments(comments);
  const attempt = buildAttemptRecord(summary, session, opts.attemptStatus, nextAttemptSequence(existingAttempts));
  const timeline = buildGoalTimeline([...existingAttempts, attempt]);
  const evidence = renderEvidence(issue, summary, session, timeline);
  const comment = markdownForFinish(issue, summary, session, evidence.attachment, attempt, timeline);

  if (opts.dryRun) {
    printDryRun("finish comment", comment, {
      attachment: evidence.attachment,
      html: evidence.htmlPath,
      svg: evidence.svgPath,
    });
    printDryRun("raw session output comment", markdownForRawSessionOutput(session));
    return;
  }

  const commentFile = writeTempMarkdown(evidence.dir, "finish-comment.md", comment);
  const addOutput = runMultica(opts, [
    "issue",
    "comment",
    "add",
    opts.issue!,
    "--content-file",
    commentFile,
    "--attachment",
    evidence.attachment,
    "--output",
    "json",
  ]);
  const imageUrl = imageAttachmentUrlFromCommentOutput(addOutput);
  const parent = commentIdFromCommentOutput(addOutput);
  if (imageUrl) {
    const imageCommentFile = writeTempMarkdown(evidence.dir, "finish-image.md", markdownForInlineImage(imageUrl));
    const args = ["issue", "comment", "add", opts.issue!, "--content-file", imageCommentFile, "--output", "json"];
    if (parent) {
      args.push("--parent", parent);
    }
    runMultica(opts, args);
    console.log(`Posted inline evidence image: ${imageUrl}`);
  } else {
    console.warn("WARNING: Multica did not return an image attachment URL; evidence remains attached but not inline.");
  }
  const rawOutputCommentFile = writeTempMarkdown(evidence.dir, "raw-session-output.md", markdownForRawSessionOutput(session));
  const rawOutputArgs = ["issue", "comment", "add", opts.issue!, "--content-file", rawOutputCommentFile, "--output", "json"];
  if (parent) {
    rawOutputArgs.push("--parent", parent);
  }
  runMultica(opts, rawOutputArgs);
  console.log("Posted raw session completion output.");
  console.log(`Added tracker finish comment to ${issue.identifier ?? opts.issue}`);
  console.log(`Attached evidence: ${evidence.attachment}`);
}

function summarize(opts: Options) {
  const goal = readInput(opts.goal, opts.goalFile);
  const summary = summarizeGoal(goal);
  console.log(JSON.stringify(summary, null, 2));
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  try {
    if (opts.command === "start") start(opts);
    if (opts.command === "finish") finish(opts);
    if (opts.command === "summarize") summarize(opts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: ${message}`);
    console.error(`Skill directory: ${skillDir}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
