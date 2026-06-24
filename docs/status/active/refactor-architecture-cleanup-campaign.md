# Active: Architecture Cleanup Campaign

Source gate: `docs/plans/refactor-architecture-cleanup-campaign.md`
Latest user intent: autonomous repeated verified cleanup slices.

Current slice: ready to commit shared skill metadata parser merge.

Last proof:
- `bun test scripts/lib/check-skills.test.ts scripts/lib/audit-skill-upstreams.test.ts` PASS
- `bun run check` PASS
- `git diff --check` PASS

Next proof:
- fresh discovery/shrink proof after commit

Next candidate: shrink `scripts/lib/paseo-keep-going.ts` pure decision planning
into an internal owner if behavior can be preserved with focused tests. Root
`STATUS.md` active-campaign drift cleanup is the docs-only fallback if no
higher-value code cleanup remains.

Parked work:
- Codex config old managed status-line variant migration.
- Hook/config helper deepening until a behavior-preserving seam is clear.
- MiMoCode command-wrapper pruning ownership decision.
- `plan-bakeoff` `base.mode` public manifest-key migration.

Stop condition: after the queue empties, stop only after two fresh discovery
handoffs against current `HEAD` find no clear safe P1/P2 slice after shrink
attempts.
