# Active: Architecture Cleanup Campaign

Source gate: `docs/plans/refactor-architecture-cleanup-campaign.md`
Latest user intent: autonomous repeated verified cleanup slices.

Current slice: ready to commit active campaign status drift cleanup.

Last proof:
- fresh discovery handoff after `5765769` found no higher-value safe code slice
  outside parked gates.
- stale roadmap-denial search across `STATUS.md`, `docs/status`, and
  `docs/plans` returned no matches
- `bun run check:skills` PASS
- `git diff --check` PASS

Next proof:
- fresh discovery pass 2 after commit

Next candidate: none queued; run fresh discovery pass 2 after this status
cleanup commit.

Parked work:
- Codex config old managed status-line variant migration.
- Hook/config helper deepening until a behavior-preserving seam is clear.
- MiMoCode command-wrapper pruning ownership decision.
- `plan-bakeoff` `base.mode` public manifest-key migration.

Stop condition: after the queue empties, stop only after two fresh discovery
handoffs against current `HEAD` find no clear safe P1/P2 slice after shrink
attempts.
