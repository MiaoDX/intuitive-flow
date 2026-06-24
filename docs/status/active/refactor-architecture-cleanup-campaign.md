# Active: Architecture Cleanup Campaign

Source gate: `docs/plans/refactor-architecture-cleanup-campaign.md`
Latest user intent: autonomous repeated verified cleanup slices.

Current slice: ready to commit paseo keep-going decision owner split.

Last proof:
- `bun test scripts/lib/paseo-keep-going.test.ts` PASS
- `bun run check` PASS
- `git diff --check` PASS

Next proof:
- fresh discovery/shrink proof after commit

Next candidate: root `STATUS.md` active-campaign drift cleanup if the next
fresh discovery handoff finds no higher-value code cleanup.

Parked work:
- Codex config old managed status-line variant migration.
- Hook/config helper deepening until a behavior-preserving seam is clear.
- MiMoCode command-wrapper pruning ownership decision.
- `plan-bakeoff` `base.mode` public manifest-key migration.

Stop condition: after the queue empties, stop only after two fresh discovery
handoffs against current `HEAD` find no clear safe P1/P2 slice after shrink
attempts.
