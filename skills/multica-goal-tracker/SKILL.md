---
name: multica-goal-tracker
description: |
  Track goal-driven Multica issues. Use when a user creates or maintains
  Multica issues by pasting a /goal prompt, wants Codex to summarize that goal
  into a concise issue purpose, append a normalized goal-start comment, render
  and attach a completion evidence card/screenshot from real Multica execution
  run messages or a supplied session transcript, or add additional goal attempts
  and completion proof to the same issue.
---

# Multica Goal Tracker

Use this skill to keep Multica issues consistent when the human workflow is:

1. Create or reuse a Multica issue.
2. Paste the `/goal` command that will drive a long `$intuitive-flow` or
   related skill run.
3. After the run completes, attach concise completion evidence.
4. If the result is incomplete, keep the issue open and append the next goal as
   another attempt on the same issue.
5. Repeat until the issue-level outcome is complete. The tracker card shows the
   per-goal attempt plus cumulative issue time.

Prefer appending comments over rewriting issue descriptions. Only update the
description when the user explicitly wants the issue top-level description
cleaned up.

All comments created by this skill use the current Multica user token, but they
must begin with the visible marker:

```markdown
> Agent 提交：以下内容由 Agent 帮忙整理并提交，用于和人工手写评论区分。
```

Keep this marker as the first visible line on start, evidence-card upload, and
finish details comments.

## Start Tracking

Use this after the issue exists and contains the goal, or when the user gives
you the goal text directly. Run the command from the Intuitive Flow checkout
root so the script path stays portable across clone locations.

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  start \
  --issue MIA-40
```

If the goal is not already in the issue description:

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  start \
  --issue MIA-40 \
  --goal-file /tmp/goal.txt
```

The script:

- fetches the issue via `multica issue get`;
- extracts the first fenced or visible `/goal` block when no goal is supplied;
- summarizes the goal into a short Chinese purpose, route, source artifacts, and
  proof expectation;
- appends a normalized Chinese "Goal tracking start" comment with the original
  goal.

Pass `--update-description` only when the user asks to normalize the issue
description itself. The script inserts or replaces a marked summary block and
preserves the existing description below it.

Use `--dry-run` before writing to a real issue when testing a prompt or script
change.

## Finish Tracking

Use this after the goal run is complete or after the user asks to preserve the
  state of a goal attempt on an existing issue. Do not create a new issue for this
flow unless the user explicitly asks. Finish evidence must come from real
session output: Multica execution run messages by default, a Codex JSONL
session, a skill-runner run directory, or an explicit transcript via
`--session-file`.

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  finish \
  --issue MIA-40
```

The script:

- fetches the current issue status and title;
- reuses the supplied goal, otherwise uses the latest tracked start comment,
  otherwise uses the initial `/goal` in the issue description;
- reads the latest Multica execution run via `multica issue runs` and
  `multica issue run-messages`;
- when a Codex JSONL session contains multiple terminal goals, matches the
  terminal goal back to the active goal objective; if it cannot match without
  guessing, it fails and asks for the exact `--goal`/`--goal-file`;
- records this finish as one goal attempt with hidden structured metadata in the
  finish details comment;
- reads earlier tracker attempt metadata from issue comments and renders an
  issue-level card with cumulative duration, issue start/end, current attempt,
  and recent attempt timeline under `~/.cache/multica-goal-tracker/`;
- uses Google Chrome headless to produce a PNG when available, with SVG
  fallback;
- posts a Chinese evidence-card upload comment with the rendered PNG/SVG
  attached. This parent comment is the thread entry for the Agent-generated
  record and must include a short issue-level summary: issue status, goal count,
  cumulative duration, what the issue tried, the current/final conclusion, and
  a compact attempt list. Keep this summary scannable; full raw output belongs
  in the details reply;
- reads the Multica comment-add response and posts one finish-details reply in
  the same thread. When Multica returns an image attachment URL, the details
  reply starts with `![completion-card.png](...)`, then a short overview, then
  goal details, then the real selected session attempt output as a Markdown
  code block. Keep this ordering as the default so reviewers can scan the
  rendered card first and only read raw output when needed;
- labels `complete` attempts as completion records; labels `partial`,
  `blocked`, and `failed` attempts as execution records so they do not
  masquerade as finished work.

If the issue has no Multica run history, finish fails fast instead of creating a
fake proof card. In that case pass a real Codex session JSONL for the finished
attempt:

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  finish \
  --issue MIA-40 \
  --session-file ~/.codex/sessions/2026/06/04/rollout-....jsonl
```

Or pass a real skill-runner run directory. This uses `result.md`, `eval.md`,
`last-message.md`, and `rewritten-prompt.md`; it intentionally avoids noisy
`terminal.log` output.

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  finish \
  --issue MIA-40 \
  --session-dir ~/.cache/skill-runner/runs/<run-dir>
```

Use `--allow-manual-summary --summary "..."` only when the user explicitly
accepts a manual fallback. Manual fallback is not a real session screenshot.

If the first attempt was incomplete, preserve it as an incomplete attempt:

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  finish \
  --issue MIA-40 \
  --session-file ~/.codex/sessions/...jsonl \
  --attempt-status partial
```

Then run `start` again with the follow-up goal and run `finish` again when that
follow-up completes. The next finish will become attempt #2 and the card will
show cumulative issue time across both attempts.

## Final Review

Use this when the human wants one final review thread for an issue that already
has multiple goal attempts, especially when an earlier attempt was partial and a
follow-up goal completed the issue. Do not hand-compose the comment. Put the
attempt data in JSON and let the script own the format.

```json
[
  {
    "goal": "/goal ...",
    "status": "partial",
    "sessionFile": "/home/mi/.codex/sessions/...jsonl"
  },
  {
    "goal": "/goal ...",
    "status": "complete",
    "sessionFile": "/home/mi/.codex/sessions/...jsonl"
  }
]
```

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  final-review \
  --issue MIA-40 \
  --attempts-file /tmp/multica-goal-attempts.json
```

`final-review` renders one cumulative evidence card, posts it as the thread
entry with a short issue-level summary and compact attempt list, then posts one
details reply whose first content block is the inline PNG, followed by overview,
timeline, details, and complete raw outputs for each attempt. The details reply
stores metadata for every attempt, so later tracker runs can recover cumulative
duration even if older Agent comments are cleaned up.

## Useful Options

- `--goal "..."` supplies inline goal text.
- `--goal-file -` reads the goal from stdin.
- `--attempts-file -` reads `final-review` attempt JSON from stdin.
- `--run-id <task-id>` uses a specific Multica execution run instead of the
  latest issue run.
- `--session-file -` reads real session transcript/output from stdin.
- `--session-dir <path>` reads real skill-runner artifacts from a run
  directory.
- `--summary-file -` reads manual finish summary from stdin, only with
  `--allow-manual-summary`.
- `--proof "..."` adds short verification notes to the finish card/comment.
- `--attempt-status complete|partial|blocked|failed` marks the current goal
  attempt. The default is `complete`; use `partial` when the session produced
  useful progress but did not satisfy the issue yet.
- `--allow-manual-summary` permits manual summary fallback when no session
  history exists.
- `--profile <name>` forwards a Multica profile.
- `--workspace-id <id-or-slug>` forwards an explicit workspace.
- `--dry-run` prints planned updates and renders local evidence without writing
  to Multica.

## Style

Default generated issue text to Chinese. Keep summaries short. The issue should
answer "what is this goal trying to accomplish?" without becoming a plan
document. Preserve the raw `/goal` block because it is the execution provenance.
