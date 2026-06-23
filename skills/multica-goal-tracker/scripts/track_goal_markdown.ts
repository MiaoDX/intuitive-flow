import type {
  AttemptStatus,
  GoalAttemptRecord,
  GoalTimeline,
} from "./track_goal_attempts";
import {
  encodeAttemptRecords,
} from "./track_goal_attempts";
import type {
  GoalSummary,
  PreflightContract,
  SessionEvidence,
} from "./track_goal";

type RenderableIssue = {
  identifier?: string;
  id?: string;
  title?: string;
  status?: string;
};

type FinalReviewAttempt = {
  summary: GoalSummary;
  session: SessionEvidence;
  record: GoalAttemptRecord;
};

export const agentCommentBanner = "> Agent 提交：以下内容由 Agent 帮忙整理并提交，用于和人工手写评论区分。\n\n";

export function markdownForStart(summary: GoalSummary): string {
  const sources = summary.sources.length ? summary.sources.map((s) => `\`${s}\``).join(", ") : "未在 goal 中明确。";
  return `${agentCommentBanner}<!-- multica-goal-tracker:start -->
## Goal 跟踪开始

**目标（中文）:** ${summary.purpose}

**Goal (English/source):** ${summary.sourcePurpose}

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

**目标（中文）:** ${summary.purpose}

**Goal (English/source):** ${summary.sourcePurpose}

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

export function markdownForPreflightIssueDescription(contract: PreflightContract, summary: GoalSummary): string {
  const sources = summary.sources.length ? summary.sources.map((s) => `\`${s}\``).join(", ") : "未在 goal 中明确。";
  const goal = contract.goal || summary.sourcePurpose;
  const plan = contract.canonicalSource || sources;
  return `${agentCommentBanner}<!-- multica-goal-tracker:preflight-issue:v1 -->
## Preflight 跟踪 Issue

**目标（中文）:** ${summary.purpose}

**Goal (English/source):** ${goal}

**执行入口:** ${summary.route}

**计划文件:** ${plan}

**预期验证:** ${summary.proof}

## Goal 命令

\`\`\`text
${summary.rawGoal}
\`\`\`
`;
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
  issue: RenderableIssue,
  summary: GoalSummary,
  session: SessionEvidence,
  attempt: GoalAttemptRecord,
  timeline: GoalTimeline,
): string {
  const title = attempt.status === "complete" ? "Goal 完成记录" : "Goal 执行记录";
  const outcomeLabel = attempt.status === "complete" ? "完成结果" : "执行结果";
  const rawTitle = attempt.status === "complete" ? "真实 session 完成输出" : "真实 session 执行输出";
  return `${agentCommentBanner}<!-- multica-goal-tracker:finish -->
${encodeAttemptRecords(timeline.attempts)}
## ${title}概览

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

**${outcomeLabel}:** ${session.outcome}

**Goal 目标:** ${summary.purpose}

**证据:** 下方保留真实 session 输出，便于需要时核对原始结果。

## Goal 详情

**验证说明:** ${session.proofNote}

**Goal 时间线:** 已累计 ${timeline.attempts.length} 次 goal attempt；累计耗时见上方概览。

## ${rawTitle}

${markdownCodeBlock(session.rawOutput)}
`;
}

export function markdownForFinalReview(
  issue: RenderableIssue,
  attempts: FinalReviewAttempt[],
  timeline: GoalTimeline,
): string {
  const finalAttempt = attempts[attempts.length - 1];
  if (!finalAttempt) throw new Error("final-review requires at least one attempt.");
  const finalStatus = finalAttempt.record.status;
  const firstSummary = attempts[0]?.summary;
  const attemptLines = attempts
    .map(({ record, session }) => {
      const timeRange = `${formatDateTime(record.startedAt)} - ${formatDateTime(record.completedAt)}`;
      return `- #${record.sequence} / ${record.status} / ${formatDuration(record.durationMs)}：${truncate(record.purpose, 120)}；${truncate(session.outcome, 180)}（${timeRange}）`;
    })
    .join("\n");
  const rawOutputs = attempts
    .map(({ record, session }) => {
      const title = record.status === "complete" ? "真实 session 完成输出" : "真实 session 执行输出";
      return `### #${record.sequence} / ${record.status} ${title}\n\n**时间:** ${formatDateTime(record.startedAt)} - ${formatDateTime(record.completedAt)}，${formatDuration(record.durationMs)}\n\n${markdownCodeBlock(session.rawOutput)}`;
    })
    .join("\n\n");

  return `${agentCommentBanner}<!-- multica-goal-tracker:final-review -->
${encodeAttemptRecords(timeline.attempts)}
## Goal 最终汇总概览

**Issue:** ${issue.identifier ?? issue.id ?? "unknown"}

**最终状态:** ${issue.status ?? "unknown"} / ${finalStatus}

**Goal 次数:** ${attempts.length}

**累计耗时:** ${formatDuration(timeline.totalDurationMs)}

**Issue 时间范围:** ${formatDateTime(timeline.startedAt)} - ${formatDateTime(timeline.completedAt)}

**初始目标:** ${firstSummary?.purpose ?? "未知"}

**最终结果:** ${finalAttempt.session.outcome}

**证据:** 下方保留每次真实 session 输出，便于需要时核对原始结果。

## Goal 时间线

${attemptLines}

## Goal 详情

${rawOutputs}
`;
}

export function markdownForRawSessionOutput(session: SessionEvidence, status: AttemptStatus = "complete"): string {
  const title = status === "complete" ? "真实 session 完成输出" : "真实 session 执行输出";
  return `${agentCommentBanner}<!-- multica-goal-tracker:raw-session-output -->
## ${title}

**Session 来源:** ${session.source}

**开始时间:** ${formatDateTime(session.startedAt)}

**结束时间:** ${formatDateTime(session.completedAt)}

**持续时间:** ${formatDuration(session.durationMs)}

${markdownCodeBlock(session.rawOutput)}
`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
