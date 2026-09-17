---
name: multica-goal-tracker
description: Create or update Multica goal issues and attach execution evidence when the user explicitly requests tracking.
---

# Multica Goal Tracker

Use this skill to keep Multica issues consistent when the human workflow is:

1. Create or reuse a Multica issue.
2. Paste the `/goal` command that will drive a long `$intuitive-flow` or
   related skill run.
3. After the run completes, attach concise completion evidence.
4. If the result is incomplete, keep the issue open and append the next goal as
   another attempt on the same issue.
5. Repeat until the issue-level outcome is complete. Finish comments show the
   per-goal attempt plus cumulative issue time.

The skill can also create the Multica issue from an approved
`$intuitive-preflight` contract. That path records planning provenance and the
exact executable `/goal`, then immediately appends the normalized tracker start
comment. It does not execute the goal and does not create finish evidence.

Prefer appending comments over rewriting issue descriptions. Only update the
description when the user explicitly wants the issue top-level description
cleaned up.

All comments created by this skill use the current Multica user token, but they
must begin with the visible marker:

```markdown
> Agent 提交：以下内容由 Agent 帮忙整理并提交，用于和人工手写评论区分。
```

Keep this marker as the first visible line on start, finish, and final-review
comments.

## Read for the requested operation

- [Create from approved preflight](references/create.md): creates the issue and
  start comment; does not execute the goal.
- [Start an attempt](references/start.md): records an existing issue and goal.
- [Finish or final review](references/finish.md): attaches source evidence and
  distinguishes a completed goal attempt from a completed issue.

Use the installed skill root's scripts/track_goal.ts --help for current flags.
Command examples use repository-root paths; resolve them against the installed
skill directory when running outside this repository.

## Style

Default generated issue text to Chinese. Keep summaries short. The issue should
answer "what is this goal trying to accomplish?" without becoming a plan
document. Preserve the raw `/goal` block because it is the execution provenance.
