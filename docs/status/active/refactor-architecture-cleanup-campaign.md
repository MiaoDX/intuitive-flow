# Active: Architecture Cleanup Campaign

Source gate: `docs/plans/refactor-architecture-cleanup-campaign.md`
Latest user intent: autonomous repeated verified cleanup slices.

Current slice: ready to commit allowlist/prune-ledger kind ownership split.

Last proof:
- `bun test scripts/lib/default-skill-allowlist.test.ts` PASS
- `bun run check` PASS
- `git diff --check` PASS

Next proof:
- `bun test skills/plan-bakeoff/scripts/run_plan_bakeoff.test.ts`
- `bun run check`
- `git diff --check`

Next candidate: delete stale `plan-bakeoff` direct command rendering helpers and
tests now that `skill-runner` owns provider command construction.

Parked work:
- Codex config old managed status-line variant migration.
- Hook/config helper deepening until a behavior-preserving seam is clear.
- MiMoCode command-wrapper pruning ownership decision.

Stop condition: after the queue empties, stop only after two fresh discovery
handoffs against current `HEAD` find no clear safe P1/P2 slice after shrink
attempts.
