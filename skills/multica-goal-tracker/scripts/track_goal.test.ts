import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  commentIdFromCommentOutput,
  extractGoal,
  extractTrackedGoalFromComments,
  imageAttachmentUrlFromCommentOutput,
  markdownCodeBlock,
  markdownForInlineImage,
  markdownForFinish,
  markdownForRawSessionOutput,
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

  test("keeps finish comment concise and points to the raw output comment", () => {
    const summary = summarizeGoal("/goal fix the tracker\nRun bun run verify");
    const comment = markdownForFinish(
      { identifier: "MIA-40", title: "Tracker", status: "Done" },
      summary,
      {
        source: "session file",
        outcome: "RESULT_STATUS: SUCCESS",
        proofNote: "Verified with bun run verify.",
        excerpt: "Generated markdown:\n```text\ninside fence\n```",
        rawOutput: "Generated markdown:\n```text\ninside fence\n```",
        messageCount: 3,
      },
      "/tmp/card.svg",
    );

    expect(comment).toContain("## Goal 完成记录");
    expect(comment).toContain("**证据:**");
    expect(comment).toContain("完整输出已在下方代码块评论中保留");
    expect(comment).not.toContain("inside fence");
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
    });

    expect(comment).toContain("## 真实 session 完成输出");
    expect(comment).toContain(raw);
    expect(comment).not.toContain("\\`\\`\\`");
    expect(markdownCodeBlock(raw)).toContain("````text");
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
