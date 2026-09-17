# Finish and final review

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

The script picks the active goal, extracts real run/session evidence, records
attempt metadata, and posts one scannable comment with overview, timeline,
details, and raw selected output. `complete` attempts are completion records;
`partial`, `blocked`, and `failed` attempts are execution records.

If the issue has no Multica run history, finish fails fast instead of creating a
fake proof card. In that case pass a real Codex session JSONL for the finished
attempt:

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  finish \
  --issue MIA-40 \
  --session-file ~/.codex/sessions/2026/06/04/rollout-....jsonl
```

Or pass a real skill-runner run directory. It uses compact artifacts and avoids
noisy `terminal.log` output.

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  finish \
  --issue MIA-40 \
  --session-dir ~/.cache/skill-runner/runs/<run-dir>
```

Use `--allow-manual-summary --summary "..."` only when the user explicitly
accepts a manual fallback. Manual fallback is not real session proof.

If an attempt is incomplete, finish it with `--attempt-status partial|blocked|failed`,
then run `start` again for the follow-up goal. The next finish becomes the next
attempt and the card shows cumulative issue time.

## Final Review

Use this when the human wants one final review thread for an issue that already
has multiple goal attempts, especially when an earlier attempt was partial and a
follow-up goal completed the issue. Do not hand-compose the comment. Put the
attempt data in JSON and let the script own the format.

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  final-review \
  --issue MIA-40 \
  --attempts-file /tmp/multica-goal-attempts.json
```

`final-review` posts one text comment with a short issue-level summary, compact
attempt list, overview, timeline, details, and complete raw outputs for each
attempt. The comment stores metadata for every attempt, so later tracker runs
can recover cumulative duration even if older Agent comments are cleaned up.
