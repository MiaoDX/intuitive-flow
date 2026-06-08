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
4. Repeat on the same issue when a later goal extends or repairs the work.

Prefer appending comments over rewriting issue descriptions. Only update the
description when the user explicitly wants the issue top-level description
cleaned up.

## Start Tracking

Use this after the issue exists and contains the goal, or when the user gives
you the goal text directly.

```bash
bun /home/mi/ws/intuitive-flow/skills/multica-goal-tracker/scripts/track_goal.ts \
  start \
  --issue MIA-40
```

If the goal is not already in the issue description:

```bash
bun /home/mi/ws/intuitive-flow/skills/multica-goal-tracker/scripts/track_goal.ts \
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
completed state on an existing issue. Do not create a new issue for this flow
unless the user explicitly asks. Finish evidence must come from real session
output: Multica execution run messages by default, a Codex JSONL session, a
skill-runner run directory, or an explicit transcript via `--session-file`.

```bash
bun /home/mi/ws/intuitive-flow/skills/multica-goal-tracker/scripts/track_goal.ts \
  finish \
  --issue MIA-40
```

The script:

- fetches the current issue status and title;
- reuses the supplied goal, extracts it from the issue description, or falls
  back to the latest tracked start comment;
- reads the latest Multica execution run via `multica issue runs` and
  `multica issue run-messages`;
- renders a completion evidence card under `~/.cache/multica-goal-tracker/`;
- uses Google Chrome headless to produce a PNG when available, with SVG
  fallback;
- appends a Chinese "Goal finish" comment and attaches the rendered evidence;
- reads the Multica comment-add response and, when an image attachment URL is
  returned, adds a child comment containing `![completion-card.png](...)` so the
  card is displayed inline in the issue timeline. The CLI currently has no
  standalone upload command and no comment update command, so this uses a reply
  instead of editing the original finish comment;
- appends another child comment with the real selected session completion output
  as a plain Markdown code block. This raw output is not rendered into an image
  and is not summarized, so the issue keeps the actual completion text alongside
  the overview card.

If the issue has no Multica run history, finish fails fast instead of creating a
fake proof card. In that case pass a real completed Codex session JSONL:

```bash
bun /home/mi/ws/intuitive-flow/skills/multica-goal-tracker/scripts/track_goal.ts \
  finish \
  --issue MIA-40 \
  --session-file ~/.codex/sessions/2026/06/04/rollout-....jsonl
```

Or pass a real skill-runner run directory. This uses `result.md`, `eval.md`,
`last-message.md`, and `rewritten-prompt.md`; it intentionally avoids noisy
`terminal.log` output.

```bash
bun /home/mi/ws/intuitive-flow/skills/multica-goal-tracker/scripts/track_goal.ts \
  finish \
  --issue MIA-40 \
  --session-dir ~/.cache/skill-runner/runs/<run-dir>
```

Use `--allow-manual-summary --summary "..."` only when the user explicitly
accepts a manual fallback. Manual fallback is not a real session screenshot.

If the first attempt was incomplete, do not label it as completion evidence.
Attach it only as an incomplete attempt if the user asks for that history, then
run `start` again with the follow-up goal and `finish` again when the follow-up
goal is complete.

## Useful Options

- `--goal "..."` supplies inline goal text.
- `--goal-file -` reads the goal from stdin.
- `--run-id <task-id>` uses a specific Multica execution run instead of the
  latest issue run.
- `--session-file -` reads real session transcript/output from stdin.
- `--session-dir <path>` reads real skill-runner artifacts from a run
  directory.
- `--summary-file -` reads manual finish summary from stdin, only with
  `--allow-manual-summary`.
- `--proof "..."` adds short verification notes to the finish card/comment.
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
