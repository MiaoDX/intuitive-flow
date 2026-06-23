import { Buffer } from "node:buffer";

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

type AttemptSummary = {
  rawGoal: string;
  purpose: string;
  route: string;
  proof: string;
};

type AttemptSession = {
  source: string;
  outcome: string;
  proofNote: string;
  messageCount: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
};

type JsonRecord = Record<string, unknown>;

export const attemptMetaPrefix = "<!-- multica-goal-tracker:attempt ";
export const attemptMetaSuffix = " -->";
export const encodedAttemptMetaPrefix = "v1:";

export function isAttemptStatus(value: string): value is AttemptStatus {
  return value === "complete" || value === "partial" || value === "blocked" || value === "failed";
}

export function encodeAttemptRecord(record: GoalAttemptRecord): string {
  const encoded = Buffer.from(JSON.stringify(record), "utf8").toString("base64");
  return `${attemptMetaPrefix}${encodedAttemptMetaPrefix}${encoded}${attemptMetaSuffix}`;
}

export function encodeAttemptRecords(records: GoalAttemptRecord[]): string {
  return records.map(encodeAttemptRecord).join("\n");
}

export function attemptRecordFromCommentText(text: string): GoalAttemptRecord | undefined {
  return attemptRecordsFromCommentText(text)[0];
}

export function attemptRecordsFromCommentText(text: string): GoalAttemptRecord[] {
  const records: GoalAttemptRecord[] = [];
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const idx = text.indexOf(attemptMetaPrefix, searchFrom);
    if (idx < 0) break;
    const start = idx + attemptMetaPrefix.length;
    const end = text.indexOf(attemptMetaSuffix, start);
    if (end < 0) break;
    const record = parseAttemptRecordPayload(text.slice(start, end));
    if (record) {
      records.push(record);
      searchFrom = end + attemptMetaSuffix.length;
      continue;
    }

    const lastEnd = text.lastIndexOf(attemptMetaSuffix);
    if (lastEnd > end) {
      const legacyRecord = parseAttemptRecordPayload(text.slice(start, lastEnd));
      if (legacyRecord) records.push(legacyRecord);
    }
    break;
  }
  return records;
}

export function attemptRecordsFromComments(comments: unknown[]): GoalAttemptRecord[] {
  const records = comments.flatMap((comment) => attemptRecordsFromCommentText(textFromUnknown(comment)));
  const deduped = new Map<string, GoalAttemptRecord>();
  for (const record of records) {
    const key = [
      record.sequence,
      record.status,
      record.startedAt ?? "",
      record.completedAt ?? "",
      record.recordedAt,
      record.goal,
    ].join("\u0000");
    deduped.set(key, record);
  }
  return [...deduped.values()].sort((a, b) => {
    const bySequence = a.sequence - b.sequence;
    if (bySequence !== 0) return bySequence;
    return Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
  });
}

export function buildAttemptRecord(
  summary: AttemptSummary,
  session: AttemptSession,
  status: AttemptStatus,
  sequence: number,
): GoalAttemptRecord {
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

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : undefined;
}

function textFromUnknown(value: unknown): string {
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
