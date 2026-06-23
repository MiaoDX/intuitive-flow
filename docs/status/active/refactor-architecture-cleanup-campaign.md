# Active: Architecture Cleanup Campaign

Source gate: `docs/plans/refactor-architecture-cleanup-campaign.md`
Latest user intent: autonomous repeated verified cleanup slices.

Current slice: ready to commit GSD workflow task owner split.

Last proof:
- `bash -n scripts/update.sh scripts/tasks/*.sh scripts/lib/*.sh` PASS
- `bun test scripts/lib/managed-skill-state.test.ts` PASS
- `bun run check:shell` PASS
- `bun run check` PASS
- `git diff --check` PASS

Next proof:
- for next slice, likely `bun test skills/multica-goal-tracker/scripts/track_goal.test.ts`
- `bun run check`

Next candidate: shrink `skills/multica-goal-tracker/scripts/track_goal.ts` by
moving markdown rendering helpers behind an internal rendering owner while
preserving hidden markers, issue comment formats, and Multica invocation order.

Parked work:
- Codex config old managed status-line variant migration.
- Hook/config helper deepening until a behavior-preserving seam is clear.
- MiMoCode command-wrapper pruning ownership decision.
- `plan-bakeoff` `base.mode` public manifest-key migration.

Stop condition: after the queue empties, stop only after two fresh discovery
handoffs against current `HEAD` find no clear safe P1/P2 slice after shrink
attempts.
