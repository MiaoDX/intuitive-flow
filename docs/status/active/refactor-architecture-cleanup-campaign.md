# Active: Architecture Cleanup Campaign

Source gate: `docs/plans/refactor-architecture-cleanup-campaign.md`
Latest user intent: autonomous repeated verified cleanup slices.

Current slice: ready to commit managed skill state dispatcher deletion.

Last proof:
- `bun test scripts/lib/skill-state-lifecycle.test.ts scripts/lib/sync-local-commands-skills.test.ts` PASS
- `bun run check` PASS
- `bun run check:shell` PASS
- `git diff --check` PASS

Next proof:
- fresh discovery handoff after commit

Next candidate: none queued; run fresh discovery against current `HEAD`.

Parked work:
- Codex config old managed status-line variant migration.
- Hook/config helper deepening until a behavior-preserving seam is clear.
- MiMoCode command-wrapper pruning ownership decision.
- `plan-bakeoff` `base.mode` public manifest-key migration.

Stop condition: after the queue empties, stop only after two fresh discovery
handoffs against current `HEAD` find no clear safe P1/P2 slice after shrink
attempts.
