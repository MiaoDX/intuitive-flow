import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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

type JsonRecord = Record<string, unknown>;

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
  return normalizeGoalLines(goal)
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

function readableFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

function stripCodeFenceNoise(text: string): string {
  return text
    .replace(/```[a-zA-Z0-9_-]*\n/g, "")
    .replace(/```/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function normalizeGoalLines(goal: string): string[] {
  return stripCodeFenceNoise(goal)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^\/goal\b\s*/i, "").trim())
    .filter(Boolean)
    .filter((line) => !/^\$skill-runner\b/.test(line));
}

function truncate(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}...`;
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
