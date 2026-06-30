# Active: Architecture Cleanup Campaign

Source gate: `docs/plans/refactor-architecture-cleanup-campaign.md`
Latest user intent: autonomous repeated verified cleanup slices.

Current slice: none. Campaign saturated after a fresh discovery pass against
the latest implementation commit before this checkpoint.

Last proof:
- fresh discovery pass after `43d92ea` found no clear safe P1/P2 code, test,
  or docs slice outside parked gates after shrink attempts.
- exact stale-surface searches for `agent-deck`, `mimocode`, `base.mode`,
  `status-line`, and old managed variants either found no current surface or
  matched the parked gates below.
- hook-helper review confirmed the latest `agent-deck` fixture deletion did not
  leave a new stale test or wrapper seam.
- high-noise summary found no tracked generated/log/test residue requiring a
  deep-read candidate.
- line-count and import/caller probes found no new pass-through owner or
  duplicate concept owner outside already deepened modules and parked public
  surfaces.
- fresh discovery handoff after `5765769` found no higher-value safe code slice
  outside parked gates, but selected the source-of-truth status cleanup.
- source-of-truth status cleanup landed in `5b2acbb`.
- fresh discovery pass 2 after `5b2acbb` found no clear safe P1/P2 code or docs
  slice outside parked gates after shrink attempts.
- stale status searches across `STATUS.md`, `docs/status`, and `docs/plans`
  leave no queued safe candidate.
- `bun run check:skills` PASS
- `bun run verify` PASS
- `git diff --check` PASS

Next proof: none queued.

Next candidate: none queued.

Parked work:
- Codex config old managed status-line variant migration; unblock with an
  explicit compatibility policy for existing user config.
- Hook/config helper deepening; unblock with a behavior-preserving seam that
  does not alter settings merge behavior.
- MiMoCode command-wrapper pruning; unblock with a current ownership decision
  for those wrappers.
- `plan-bakeoff` `base.mode` public manifest-key migration; unblock with an
  accepted schema/public artifact migration.

Stop condition: met. A fresh discovery pass against implementation commit
`43d92ea` found no clear safe P1/P2 slice after shrink attempts; only the
parked gates above remain. Later campaign-state commits only record that
saturation evidence.
