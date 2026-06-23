# Active: Architecture Cleanup Campaign

Source gate: `docs/plans/refactor-architecture-cleanup-campaign.md`
Latest user intent: autonomous repeated verified cleanup slices.

Current slice: ready to commit `plan-bakeoff` stale command renderer deletion.

Last proof:
- `bun test skills/plan-bakeoff/scripts/run_plan_bakeoff.test.ts` PASS
- `bun run check` PASS
- stale-reference search for `renderCandidateCommand` PASS
- `git diff --check` PASS

Next proof:
- `bun run check:skills`
- `rg -n -F 'plan-bakeoff' README.md ARCHITECTURE.md STATUS.md docs/human scripts/default-skill-allowlist.txt skills`
- `git diff --check`

Next candidate: align human docs with the default-visible `plan-bakeoff` direct
utility.

Parked work:
- Codex config old managed status-line variant migration.
- Hook/config helper deepening until a behavior-preserving seam is clear.
- MiMoCode command-wrapper pruning ownership decision.
- `plan-bakeoff` `base.mode` public manifest-key migration.

Stop condition: after the queue empties, stop only after two fresh discovery
handoffs against current `HEAD` find no clear safe P1/P2 slice after shrink
attempts.
