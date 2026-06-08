import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  commentIdFromCommentOutput,
  agentCommentBanner,
  attemptRecordFromCommentText,
  attemptRecordsFromComments,
  buildAttemptRecord,
  buildGoalTimeline,
  evidenceFromCodexJsonl,
  extractGoal,
  extractTrackedGoalFromComments,
  imageAttachmentUrlFromCommentOutput,
  markdownCodeBlock,
  markdownForEvidenceCardUpload,
  markdownForFinalReview,
  markdownForInlineImage,
  markdownForFinish,
  markdownForRawSessionOutput,
  markdownForStart,
  nextAttemptSequence,
  normalizeLines,
  replaceMarkedBlock,
  selectLatestRunId,
  sessionEvidenceFromSessionText,
  sessionEvidenceFromSkillRunnerDir,
  sessionEvidenceFromTranscript,
  summarizeGoal,
  transcriptFromCodexJsonl,
} from "./track_goal";

describe("multica goal tracker", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("extracts the first fenced goal block from an issue description", () => {
    const description = `
Context before the goal.

\`\`\`text
/goal execute docs/plans/refactor-api.md with $intuitive-flow
Run bun run verify before commit.
\`\`\`

Later notes should not be treated as the active goal.
`;

    expect(extractGoal(description)).toBe(
      "/goal execute docs/plans/refactor-api.md with $intuitive-flow\nRun bun run verify before commit.",
    );
  });

  test("keeps inline /goal action text when summarizing", () => {
    const summary = summarizeGoal(
      "/goal fix the broken sync path with $intuitive-flow\nVerify with bun run verify\nSource: docs/plans/refactor-sync.md",
    );

    expect(normalizeLines(summary.rawGoal)[0]).toBe("fix the broken sync path with $intuitive-flow");
    expect(summary.purpose).toBe("修复 the broken sync path with $intuitive-flow");
    expect(summary.route).toBe("$intuitive-flow");
    expect(summary.sources).toEqual(["docs/plans/refactor-sync.md"]);
    expect(summary.proof).toContain("验证 with bun run verify");
  });

  test("marks generated comments as agent-submitted", () => {
    const summary = summarizeGoal("/goal fix the tracker\nRun bun run verify");
    const session = sessionEvidenceFromTranscript("session file", "RESULT_STATUS: SUCCESS\nVerified.");
    const attempt = buildAttemptRecord(summary, { ...session, durationMs: 10_000 }, "complete", 1);
    const timeline = buildGoalTimeline([attempt]);

    expect(markdownForStart(summary).startsWith(agentCommentBanner)).toBe(true);
    expect(markdownForFinish({ identifier: "MIA-40", status: "done" }, summary, session, "/tmp/card.png", attempt, timeline).startsWith(agentCommentBanner)).toBe(true);
    expect(markdownForEvidenceCardUpload({ identifier: "MIA-40", status: "done" }, attempt, timeline).startsWith(agentCommentBanner)).toBe(true);
    expect(markdownForRawSessionOutput(session).startsWith(agentCommentBanner)).toBe(true);
    expect(markdownForInlineImage("/uploads/workspaces/ws/card.png").startsWith(agentCommentBanner)).toBe(true);
  });

  test("normalizes real transcript evidence without inventing proof", () => {
    const evidence = sessionEvidenceFromTranscript(
      "session file /tmp/run.log",
      "\u001b[32mStarting\u001b[0m\r\n\nRan bun run verify\nRESULT_STATUS: SUCCESS\nCommitted abc123\n",
      "Verified with bun run verify.",
    );

    expect(evidence.source).toBe("session file /tmp/run.log");
    expect(evidence.messageCount).toBe(4);
    expect(evidence.outcome).toContain("RESULT_STATUS: SUCCESS");
    expect(evidence.proofNote).toBe("Verified with bun run verify.");
    expect(evidence.excerpt).toContain("Ran bun run verify");
    expect(evidence.rawOutput).toContain("Committed abc123");
    expect(evidence.excerpt).not.toContain("\u001b[32m");
  });

  test("summarizes completion transcripts from their leading decision instead of trailing verification", () => {
    const evidence = sessionEvidenceFromTranscript(
      "session file /tmp/run.log",
      "Completed the waist-range prior audit.\nDecision: no new default.\nEvidence summary:\n- active waist failed representative suite.\nVerification passed:\n- make docs-check\n- git diff --check\n",
    );

    expect(evidence.outcome).toContain("Completed the waist-range prior audit.");
    expect(evidence.outcome).toContain("Decision: no new default.");
    expect(evidence.outcome).not.toContain("git diff --check");
  });

  test("extracts real assistant result output from Codex JSONL", () => {
    const jsonl = [
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Working note that should not be final." }],
        },
      },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "RESULT_STATUS: SUCCESS\nSUMMARY: Added canonical metrics.\nVERIFICATION: tests passed.",
            },
          ],
        },
      },
    ]
      .map((value) => JSON.stringify(value))
      .join("\n");

    expect(transcriptFromCodexJsonl(jsonl)).toContain("RESULT_STATUS: SUCCESS");

    const evidence = sessionEvidenceFromSessionText("file session.jsonl", jsonl);
    expect(evidence.source).toBe("codex session file session.jsonl");
    expect(evidence.proofNote).toBe("从真实 Codex session assistant 输出中提取。");
    expect(evidence.excerpt).toContain("SUMMARY: Added canonical metrics.");
    expect(evidence.excerpt).not.toContain("Working note");
  });

  test("extracts goal timing from Codex JSONL completion metadata", () => {
    const finalMessage = "Implemented.\nVerification:\n- tests passed.";
    const jsonl = [
      {
        timestamp: "2026-06-04T04:57:29.560Z",
        type: "event_msg",
        payload: {
          type: "thread_goal_updated",
          turnId: "goal-turn",
          goal: {
            status: "complete",
            createdAt: 1780548502,
            updatedAt: 1780549049,
            timeUsedSeconds: 547,
          },
        },
      },
      {
        timestamp: "2026-06-04T04:57:43.182Z",
        type: "event_msg",
        payload: {
          type: "agent_message",
          turn_id: "goal-turn",
          message: finalMessage,
        },
      },
      {
        timestamp: "2026-06-04T04:57:43.292Z",
        type: "event_msg",
        payload: {
          type: "task_complete",
          turn_id: "goal-turn",
          last_agent_message: finalMessage,
          completed_at: 1780549063,
          duration_ms: 561085,
        },
      },
    ]
      .map((value) => JSON.stringify(value))
      .join("\n");

    const codexEvidence = evidenceFromCodexJsonl(jsonl);
    expect(codexEvidence?.transcript).toBe(finalMessage);
    expect(codexEvidence?.startedAt).toBe("2026-06-04T04:48:22.000Z");
    expect(codexEvidence?.completedAt).toBe("2026-06-04T04:57:29.000Z");
    expect(codexEvidence?.durationMs).toBe(547000);

    const evidence = sessionEvidenceFromSessionText("file session.jsonl", jsonl);
    expect(evidence.startedAt).toBe("2026-06-04T04:48:22.000Z");
    expect(evidence.completedAt).toBe("2026-06-04T04:57:29.000Z");
    expect(evidence.durationMs).toBe(547000);
  });

  test("uses explicit goal accounting from Codex task output when terminal goal metadata is absent", () => {
    const finalMessage = "Goal is complete. Final goal accounting: 5717 seconds elapsed; no token budget was set.\n\nVerification passed.";
    const jsonl = [
      {
        timestamp: "2026-05-09T08:43:23.899Z",
        type: "event_msg",
        payload: {
          type: "task_complete",
          last_agent_message: finalMessage,
          completed_at: 1778316203,
          duration_ms: 215310,
        },
      },
    ]
      .map((value) => JSON.stringify(value))
      .join("\n");

    const evidence = evidenceFromCodexJsonl(jsonl);
    expect(evidence?.transcript).toBe(finalMessage);
    expect(evidence?.startedAt).toBe("2026-05-09T07:08:06.000Z");
    expect(evidence?.completedAt).toBe("2026-05-09T08:43:23.000Z");
    expect(evidence?.durationMs).toBe(5_717_000);
  });

  test("extracts goal timing from blocked Codex JSONL terminal metadata", () => {
    const finalMessage = "RESULT_STATUS: BLOCKED\nNeed external input.";
    const jsonl = [
      {
        timestamp: "2026-06-04T05:10:00.000Z",
        type: "event_msg",
        payload: {
          type: "thread_goal_updated",
          turnId: "blocked-turn",
          goal: {
            status: "blocked",
            objective: "Investigate the blocked tracker run.",
            createdAt: 1780549500,
            updatedAt: 1780549800,
            timeUsedSeconds: 300,
          },
        },
      },
      {
        timestamp: "2026-06-04T05:10:02.000Z",
        type: "event_msg",
        payload: {
          type: "agent_message",
          turn_id: "blocked-turn",
          message: finalMessage,
        },
      },
    ]
      .map((value) => JSON.stringify(value))
      .join("\n");

    const evidence = evidenceFromCodexJsonl(jsonl, "/goal Investigate the blocked tracker run.");
    expect(evidence?.transcript).toBe(finalMessage);
    expect(evidence?.startedAt).toBe("2026-06-04T05:05:00.000Z");
    expect(evidence?.completedAt).toBe("2026-06-04T05:10:00.000Z");
    expect(evidence?.durationMs).toBe(300_000);
  });

  test("prefers the completed goal turn over later Codex session turns", () => {
    const goalOutput = "Implemented.\nVerification:\n- focused tests passed.";
    const laterOutput = "Committed the intended changes:\n`abc123 later commit`";
    const jsonl = [
      {
        timestamp: "2026-06-04T04:57:29.560Z",
        type: "event_msg",
        payload: {
          type: "thread_goal_updated",
          turnId: "goal-turn",
          goal: {
            status: "complete",
            createdAt: 1780548502,
            updatedAt: 1780549049,
            timeUsedSeconds: 547,
          },
        },
      },
      {
        timestamp: "2026-06-04T04:57:43.182Z",
        type: "event_msg",
        payload: {
          type: "agent_message",
          turn_id: "goal-turn",
          message: goalOutput,
        },
      },
      {
        timestamp: "2026-06-04T05:00:20.017Z",
        type: "event_msg",
        payload: {
          type: "agent_message",
          turn_id: "commit-turn",
          message: laterOutput,
        },
      },
    ]
      .map((value) => JSON.stringify(value))
      .join("\n");

    expect(evidenceFromCodexJsonl(jsonl)?.transcript).toBe(goalOutput);
  });

  test("keeps a completed goal turn even when the message is not template-shaped", () => {
    const goalOutput = "完成了，验证通过。";
    const laterOutput = "Committed the intended changes:\n`abc123 later commit`";
    const jsonl = [
      {
        timestamp: "2026-06-04T04:57:29.560Z",
        type: "event_msg",
        payload: {
          type: "thread_goal_updated",
          turnId: "goal-turn",
          goal: {
            status: "complete",
            createdAt: 1780548502,
            updatedAt: 1780549049,
            timeUsedSeconds: 547,
          },
        },
      },
      {
        timestamp: "2026-06-04T04:57:43.182Z",
        type: "event_msg",
        payload: {
          type: "agent_message",
          turn_id: "goal-turn",
          message: goalOutput,
        },
      },
      {
        timestamp: "2026-06-04T05:00:20.017Z",
        type: "event_msg",
        payload: {
          type: "agent_message",
          turn_id: "commit-turn",
          message: laterOutput,
        },
      },
    ]
      .map((value) => JSON.stringify(value))
      .join("\n");

    expect(evidenceFromCodexJsonl(jsonl)?.transcript).toBe(goalOutput);
  });

  test("matches Codex completion timing to the issue goal instead of the latest follow-up goal", () => {
    const issueGoal = "/goal\n\nImpl docs/plans/refactor-g1-curobo-official-candidate-quality-policy.md via $intuitive-flow\n\nuse 8 cases visual harness to make sure no clear regression.";
    const originalOutput = "Implemented.\nVerification:\n- first full goal passed.";
    const followUpOutput = "Implemented.\nVerification:\n- follow-up tests passed.";
    const jsonl = [
      {
        timestamp: "2026-06-03T02:55:19.000Z",
        type: "event_msg",
        payload: {
          type: "thread_goal_updated",
          turnId: "original-goal-turn",
          goal: {
            objective: "Impl docs/plans/refactor-g1-curobo-official-candidate-quality-policy.md via $intuitive-flow\n\nuse 8 cases visual harness to make sure no clear regression.",
            status: "complete",
            createdAt: 1780443862,
            updatedAt: 1780445719,
            timeUsedSeconds: 1856,
          },
        },
      },
      {
        timestamp: "2026-06-03T02:55:31.000Z",
        type: "event_msg",
        payload: {
          type: "agent_message",
          turn_id: "original-goal-turn",
          message: originalOutput,
        },
      },
      {
        timestamp: "2026-06-04T04:57:29.560Z",
        type: "event_msg",
        payload: {
          type: "thread_goal_updated",
          turnId: "follow-up-turn",
          goal: {
            objective: "LGTM, do these plz\n\nand if it is better, run needed tests, and prompt it to scripts/deploy_g1.py too, for both decoupled and sonic way",
            status: "complete",
            createdAt: 1780548502,
            updatedAt: 1780549049,
            timeUsedSeconds: 547,
          },
        },
      },
      {
        timestamp: "2026-06-04T04:57:43.182Z",
        type: "event_msg",
        payload: {
          type: "agent_message",
          turn_id: "follow-up-turn",
          message: followUpOutput,
        },
      },
    ]
      .map((value) => JSON.stringify(value))
      .join("\n");

    const evidence = evidenceFromCodexJsonl(jsonl, issueGoal);
    expect(evidence?.transcript).toBe(originalOutput);
    expect(evidence?.durationMs).toBe(1_856_000);

    const sessionEvidence = sessionEvidenceFromSessionText("file session.jsonl", jsonl, undefined, issueGoal);
    expect(sessionEvidence.rawOutput).toBe(originalOutput);
    expect(sessionEvidence.durationMs).toBe(1_856_000);
  });

  test("fails instead of attaching matched goal timing to unrelated fallback output", () => {
    const issueGoal = "/goal\n\nImplement the original planner refactor.";
    const followUpOutput = "Implemented.\nVerification:\n- follow-up tests passed.";
    const jsonl = [
      {
        timestamp: "2026-06-03T02:55:19.000Z",
        type: "event_msg",
        payload: {
          type: "thread_goal_updated",
          turnId: "original-goal-turn",
          goal: {
            objective: "Implement the original planner refactor.",
            status: "complete",
            createdAt: 1780443862,
            updatedAt: 1780445719,
            timeUsedSeconds: 1856,
          },
        },
      },
      {
        timestamp: "2026-06-04T04:57:43.182Z",
        type: "event_msg",
        payload: {
          type: "agent_message",
          turn_id: "follow-up-turn",
          message: followUpOutput,
        },
      },
    ]
      .map((value) => JSON.stringify(value))
      .join("\n");

    expect(() => evidenceFromCodexJsonl(jsonl, issueGoal)).toThrow("assistant attempt output");
  });

  test("builds evidence from skill-runner result artifacts without terminal logs", () => {
    const dir = mkdtempSync(join(tmpdir(), "multica-goal-tracker-"));
    tempDirs.push(dir);
    writeFileSync(join(dir, "result.md"), "- Status: SUCCESS\n- Reason: worker reported RESULT_STATUS: SUCCESS\n");
    writeFileSync(join(dir, "eval.md"), "## Workspace Diff\n\n```text\nclean\n```\n");
    writeFileSync(join(dir, "last-message.md"), "RESULT_STATUS: SUCCESS\nSUMMARY: Worker completed.\n");
    writeFileSync(join(dir, "terminal.log"), "\u001b[32mnoisy terminal output\u001b[0m\n");

    const evidence = sessionEvidenceFromSkillRunnerDir(dir);
    expect(evidence.source).toBe(`skill-runner dir ${dir}`);
    expect(evidence.outcome).toContain("RESULT_STATUS: SUCCESS");
    expect(evidence.excerpt).toContain("Worker completed.");
    expect(evidence.excerpt).not.toContain("noisy terminal output");
  });

  test("reuses the latest tracked start comment when the description has no goal", () => {
    const comments = [
      {
        created_at: "2026-06-08T05:00:00Z",
        content: `<!-- multica-goal-tracker:start -->
## Tracked goal start

**Goal command:**

\`\`\`text
/goal refactor docs/plans/current.md with $intuitive-refactor
Run bun run verify.
\`\`\``,
      },
      {
        created_at: "2026-06-08T04:00:00Z",
        content: `<!-- multica-goal-tracker:start -->
## Tracked goal start

**Goal command:**

\`\`\`text
/goal fix an older issue with $intuitive-flow
\`\`\``,
      },
    ];

    expect(extractTrackedGoalFromComments(comments)).toBe(
      "/goal refactor docs/plans/current.md with $intuitive-refactor\nRun bun run verify.",
    );
  });

  test("selects the newest run by timestamp instead of assuming response order", () => {
    expect(
      selectLatestRunId([
        { id: "newest-first", created_at: "2026-06-08T05:00:00Z" },
        { id: "oldest-last", created_at: "2026-06-08T04:00:00Z" },
      ]),
    ).toBe("newest-first");

    expect(selectLatestRunId([{ id: "first" }, { id: "last" }])).toBe("last");
  });

  test("keeps detail comments textual with overview before raw output", () => {
    const summary = summarizeGoal("/goal fix the tracker\nRun bun run verify");
    const session = {
      source: "session file",
      outcome: "RESULT_STATUS: SUCCESS",
      proofNote: "Verified with bun run verify.",
      excerpt: "Generated markdown:\n```text\ninside fence\n```",
      rawOutput: "Generated markdown:\n```text\ninside fence\n```",
      messageCount: 3,
      startedAt: "2026-06-04T04:48:22.000Z",
      completedAt: "2026-06-04T04:57:29.000Z",
      durationMs: 547000,
    };
    const attempt = buildAttemptRecord(summary, session, "complete", 2);
    const timeline = buildGoalTimeline([
      {
        ...attempt,
        sequence: 1,
        purpose: "初始 goal",
        durationMs: 120000,
        startedAt: "2026-06-04T04:40:00.000Z",
        completedAt: "2026-06-04T04:42:00.000Z",
      },
      attempt,
    ]);
    const comment = markdownForFinish(
      { identifier: "MIA-40", title: "Tracker", status: "Done" },
      summary,
      session,
      "/tmp/card.svg",
      attempt,
      timeline,
    );

    const overviewIndex = comment.indexOf("## Goal 完成记录概览");
    const detailsIndex = comment.indexOf("## Goal 详情");
    const rawOutputIndex = comment.indexOf("## 真实 session 完成输出");

    expect(comment).not.toContain("![completion-card.png]");
    expect(overviewIndex).toBeGreaterThan(-1);
    expect(detailsIndex).toBeGreaterThan(overviewIndex);
    expect(rawOutputIndex).toBeGreaterThan(detailsIndex);
    expect(comment).toContain("multica-goal-tracker:attempt");
    expect(comment).toContain("**证据:**");
    expect(comment).toContain("**本次 Goal:** #2 / complete");
    expect(comment).toContain("**本次持续时间:** 9m 7s");
    expect(comment).toContain("**Issue 累计耗时:** 11m 7s");
    expect(comment).toContain("父评论末尾的 PNG");
    expect(comment).toContain("inside fence");
    expect(markdownCodeBlock(session.rawOutput)).toContain("````text");
  });

  test("builds a top evidence card comment with summary and image at the end", () => {
    const summary = summarizeGoal("/goal fix the tracker\nRun bun run verify");
    const session = sessionEvidenceFromTranscript("session file", "RESULT_STATUS: SUCCESS\nVerified.");
    const attempt = buildAttemptRecord(summary, { ...session, durationMs: 10_000 }, "complete", 1);
    const timeline = buildGoalTimeline([attempt]);
    const comment = markdownForEvidenceCardUpload(
      { identifier: "MIA-40", status: "Done" },
      attempt,
      timeline,
      "/uploads/workspaces/ws/completion-card.png",
    );

    expect(comment).toContain("<!-- multica-goal-tracker:evidence-card-upload -->");
    expect(comment).toContain("## Goal 完成卡片");
    expect(comment).toContain("**最新 Goal:** #1 / complete");
    expect(comment).toContain("**Goal 次数:** 1");
    expect(comment).toContain("**累计耗时:** 10s");
    expect(comment).toContain("## 简要总结");
    expect(comment).toContain("围绕「修复 the tracker」推进");
    expect(comment).toContain("## 尝试过程");
    expect(comment).toContain("- #1 完成 / 10s：修复 the tracker");
    expect(comment).toContain("下方回复只保留详情和真实 session 输出。");
    const summaryIndex = comment.indexOf("## 简要总结");
    const attemptsIndex = comment.indexOf("## 尝试过程");
    const imageIndex = comment.indexOf("![completion-card.png](/uploads/workspaces/ws/completion-card.png)");
    expect(imageIndex).toBeGreaterThan(attemptsIndex);
    expect(attemptsIndex).toBeGreaterThan(summaryIndex);
  });

  test("summarizes multiple attempts in the top evidence card upload comment", () => {
    const firstSummary = summarizeGoal("/goal implement first slice via $intuitive-flow");
    const secondSummary = summarizeGoal("/goal complete follow-up defaults via $intuitive-flow");
    const firstSession = sessionEvidenceFromTranscript("first session", "RESULT_STATUS: PARTIAL\nFirst raw output.");
    const secondSession = sessionEvidenceFromTranscript("second session", "RESULT_STATUS: SUCCESS\nSecond raw output.");
    const first = buildAttemptRecord(firstSummary, { ...firstSession, durationMs: 60_000 }, "partial", 1);
    const second = buildAttemptRecord(secondSummary, { ...secondSession, durationMs: 90_000 }, "complete", 2);
    const timeline = buildGoalTimeline([first, second]);
    const comment = markdownForEvidenceCardUpload({ identifier: "MIA-40", status: "done" }, second, timeline);

    expect(comment).toContain("**Goal 次数:** 2");
    expect(comment).toContain("**Issue 状态:** done / complete");
    expect(comment).toContain("最终结论：RESULT_STATUS: SUCCESS Second raw output.");
    expect(comment).toContain("- #1 部分完成 / 1m 0s：实现 first slice");
    expect(comment).toContain("- #2 完成 / 1m 30s：complete follow-up defaults");
  });

  test("builds final-review details with overview first and raw outputs last", () => {
    const firstSummary = summarizeGoal("/goal implement first slice via $intuitive-flow");
    const secondSummary = summarizeGoal("/goal complete follow-up defaults via $intuitive-flow");
    const firstSession = sessionEvidenceFromTranscript("first session", "RESULT_STATUS: PARTIAL\nFirst raw output.");
    const secondSession = sessionEvidenceFromTranscript("second session", "RESULT_STATUS: SUCCESS\nSecond raw output.");
    const first = buildAttemptRecord(firstSummary, { ...firstSession, durationMs: 60_000 }, "partial", 1);
    const second = buildAttemptRecord(secondSummary, { ...secondSession, durationMs: 90_000 }, "complete", 2);
    const attempts = [
      { summary: firstSummary, session: firstSession, record: first },
      { summary: secondSummary, session: secondSession, record: second },
    ];
    const timeline = buildGoalTimeline([first, second]);
    const comment = markdownForFinalReview(
      { identifier: "MIA-40", title: "Tracker", status: "done" },
      attempts,
      timeline,
      "/tmp/card.png",
    );

    const overviewIndex = comment.indexOf("## Goal 最终汇总概览");
    const timelineIndex = comment.indexOf("## Goal 时间线");
    const rawIndex = comment.indexOf("### #1 / partial 真实 session 执行输出");
    expect(comment).not.toContain("![completion-card.png]");
    expect(overviewIndex).toBeGreaterThan(-1);
    expect(timelineIndex).toBeGreaterThan(overviewIndex);
    expect(rawIndex).toBeGreaterThan(timelineIndex);
    expect(comment).toContain("**Goal 次数:** 2");
    expect(comment).toContain("**累计耗时:** 2m 30s");
    expect(comment).toContain("First raw output.");
    expect(comment).toContain("Second raw output.");
    expect(buildGoalTimeline(attemptRecordsFromComments([{ content: comment }])).totalDurationMs).toBe(150_000);
  });

  test("preserves complete raw session output in a separate code block comment", () => {
    const raw = "Line 1\n```text\ninside fence\n```\nLine after fence";
    const comment = markdownForRawSessionOutput({
      source: "codex session file",
      outcome: "RESULT_STATUS: SUCCESS",
      proofNote: "real session",
      excerpt: "Line 1",
      rawOutput: raw,
      messageCount: 5,
      durationMs: 61_000,
    });

    expect(comment).toContain("## 真实 session 完成输出");
    expect(comment).toContain("**持续时间:** 1m 1s");
    expect(comment).toContain(raw);
    expect(comment).not.toContain("\\`\\`\\`");
    expect(markdownCodeBlock(raw)).toContain("````text");
  });

  test("labels non-complete raw session output as execution output", () => {
    const comment = markdownForRawSessionOutput({
      source: "codex session file",
      outcome: "RESULT_STATUS: BLOCKED",
      proofNote: "blocked on external input",
      excerpt: "Need input.",
      rawOutput: "RESULT_STATUS: BLOCKED\nNeed input.",
      messageCount: 2,
    }, "blocked");

    expect(comment).toContain("## 真实 session 执行输出");
    expect(comment).not.toContain("## 真实 session 完成输出");
  });

  test("extracts attempt records from finish comments and accumulates duration", () => {
    const summary = summarizeGoal("/goal implement first slice via $intuitive-flow");
    const session = sessionEvidenceFromTranscript("session file", "Implemented.\nVerification passed.");
    const first = buildAttemptRecord(summary, { ...session, durationMs: 60_000 }, "partial", 1);
    const second = buildAttemptRecord(summary, { ...session, durationMs: 90_000 }, "complete", 2);
    const firstComment = markdownForFinish(
      { identifier: "MIA-41", status: "done" },
      summary,
      session,
      "/tmp/card-1.png",
      first,
      buildGoalTimeline([first]),
    );
    const secondComment = markdownForFinish(
      { identifier: "MIA-41", status: "done" },
      summary,
      session,
      "/tmp/card-2.png",
      second,
      buildGoalTimeline([first, second]),
    );

    expect(attemptRecordFromCommentText(firstComment)?.status).toBe("partial");
    const timeline = buildGoalTimeline(attemptRecordsFromComments([{ content: firstComment }, { content: secondComment }]));
    expect(timeline.attempts).toHaveLength(2);
    expect(timeline.totalDurationMs).toBe(150_000);
    expect(nextAttemptSequence([{ ...first, sequence: 3 }, { ...second, sequence: 5 }])).toBe(6);
  });

  test("stores the full attempt timeline in each finish details comment", () => {
    const summary = summarizeGoal("/goal implement first slice via $intuitive-flow");
    const session = sessionEvidenceFromTranscript("session file", "Implemented.\nVerification passed.");
    const first = buildAttemptRecord(summary, { ...session, durationMs: 60_000 }, "partial", 1);
    const second = buildAttemptRecord(summary, { ...session, durationMs: 90_000 }, "complete", 2);
    const latestComment = markdownForFinish(
      { identifier: "MIA-41", status: "done" },
      summary,
      session,
      "/tmp/card-2.png",
      second,
      buildGoalTimeline([first, second]),
    );

    const timelineFromLatestOnly = buildGoalTimeline(attemptRecordsFromComments([{ content: latestComment }]));
    expect(timelineFromLatestOnly.attempts.map((attempt) => attempt.sequence)).toEqual([1, 2]);
    expect(timelineFromLatestOnly.totalDurationMs).toBe(150_000);

    const timelineWithDuplicateOldComment = buildGoalTimeline(
      attemptRecordsFromComments([{ content: markdownForFinish({ identifier: "MIA-41", status: "done" }, summary, session, "/tmp/card-1.png", first, buildGoalTimeline([first])) }, { content: latestComment }]),
    );
    expect(timelineWithDuplicateOldComment.attempts.map((attempt) => attempt.sequence)).toEqual([1, 2]);
    expect(timelineWithDuplicateOldComment.totalDurationMs).toBe(150_000);
  });

  test("encodes attempt metadata so comment delimiters in session text do not break timeline parsing", () => {
    const summary = summarizeGoal("/goal fix marker --> handling via $intuitive-flow");
    const session = sessionEvidenceFromTranscript("session file", "RESULT_STATUS: SUCCESS\nOutput contained --> in a rendered snippet.");
    const attempt = buildAttemptRecord(summary, session, "complete", 1);
    const comment = markdownForFinish(
      { identifier: "MIA-43", status: "Done" },
      summary,
      session,
      "/tmp/card.png",
      attempt,
      buildGoalTimeline([attempt]),
    );

    expect(comment).toContain("multica-goal-tracker:attempt v1:");
    expect(attemptRecordFromCommentText(comment)?.goal).toBe(summary.rawGoal);
    expect(attemptRecordsFromComments([{ content: comment }])).toHaveLength(1);
  });

  test("continues reading legacy raw-json attempt metadata", () => {
    const legacyComment = `<!-- multica-goal-tracker:finish -->
<!-- multica-goal-tracker:attempt {"sequence":4,"status":"complete","goal":"old goal","purpose":"old purpose","route":"manual","proof":"proof","source":"source","outcome":"ok","proofNote":"real","messageCount":1,"recordedAt":"2026-06-08T00:00:00.000Z"} -->
## Goal 完成记录`;

    expect(attemptRecordFromCommentText(legacyComment)?.sequence).toBe(4);
  });

  test("labels incomplete attempts as execution records instead of completion records", () => {
    const summary = summarizeGoal("/goal investigate a partial run via $intuitive-flow");
    const session = sessionEvidenceFromTranscript("session file", "RESULT_STATUS: PARTIAL\nVerification incomplete.");
    const attempt = buildAttemptRecord(summary, session, "partial", 1);
    const comment = markdownForFinish(
      { identifier: "MIA-42", status: "In Progress" },
      summary,
      session,
      "/tmp/card.png",
      attempt,
      buildGoalTimeline([attempt]),
    );

    expect(comment).toContain("## Goal 执行记录概览");
    expect(comment).toContain("**本次 Goal:** #1 / partial");
    expect(comment).toContain("**执行结果:**");
    expect(comment).toContain("父评论末尾的 PNG 是渲染后的执行卡片");
    expect(comment).not.toContain("## Goal 完成记录");
    expect(comment).not.toContain("**完成结果:**");
    expect(comment).not.toContain("父评论末尾的 PNG 是渲染后的完成卡片");
  });

  test("extracts image URL and comment ID from Multica comment add output", () => {
    const output = JSON.stringify({
      id: "comment-1",
      attachments: [
        {
          filename: "completion-card.png",
          content_type: "image/png",
          url: "/uploads/workspaces/ws/completion-card.png",
        },
      ],
    });

    expect(commentIdFromCommentOutput(output)).toBe("comment-1");
    expect(imageAttachmentUrlFromCommentOutput(output)).toBe("/uploads/workspaces/ws/completion-card.png");
    expect(markdownForInlineImage("/uploads/workspaces/ws/completion-card.png")).toContain(
      "![completion-card.png](/uploads/workspaces/ws/completion-card.png)",
    );
  });

  test("extracts image URL and comment ID from noisy Multica upload output", () => {
    const output = `Uploaded /tmp/completion-card.png
{
  "id": "comment-1",
  "attachments": [
    {
      "filename": "completion-card.png",
      "content_type": "image/png",
      "url": "/uploads/workspaces/ws/completion-card.png"
    }
  ]
}
Comment added to issue MIA-40.`;

    expect(commentIdFromCommentOutput(output)).toBe("comment-1");
    expect(imageAttachmentUrlFromCommentOutput(output)).toBe("/uploads/workspaces/ws/completion-card.png");
  });

  test("replaces only the marked summary block in descriptions", () => {
    const original = `Intro text.

<!-- multica-goal-tracker:summary:start -->
old summary
<!-- multica-goal-tracker:summary:end -->

User-owned details stay.`;

    const updated = replaceMarkedBlock(
      original,
      `<!-- multica-goal-tracker:summary:start -->
new summary
<!-- multica-goal-tracker:summary:end -->`,
    );

    expect(updated).toContain("Intro text.");
    expect(updated).toContain("new summary");
    expect(updated).toContain("User-owned details stay.");
    expect(updated).not.toContain("old summary");
  });
});
