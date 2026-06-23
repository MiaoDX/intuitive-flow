# Active: Architecture Cleanup Campaign

Source gate: `docs/plans/refactor-architecture-cleanup-campaign.md`
Latest user intent: autonomous repeated verified cleanup slices.

Current slice: ready to commit `plan-bakeoff` direct utility docs alignment.

Last proof:
- `bun run check:skills` PASS
- `plan-bakeoff` reference search PASS
- `git diff --check` PASS

Next proof:
- `bun test scripts/lib/managed-skill-state.test.ts scripts/lib/sync-local-commands-skills.test.ts`
- `bun run check`
- `git diff --check`

Next candidate: shrink managed skill state ownership by moving one lifecycle
slice behind a clearer internal owner while preserving CLI commands and state
paths.

Parked work:
- Codex config old managed status-line variant migration.
- Hook/config helper deepening until a behavior-preserving seam is clear.
- MiMoCode command-wrapper pruning ownership decision.
- `plan-bakeoff` `base.mode` public manifest-key migration.

Stop condition: after the queue empties, stop only after two fresh discovery
handoffs against current `HEAD` find no clear safe P1/P2 slice after shrink
attempts.
