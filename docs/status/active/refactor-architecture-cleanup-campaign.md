# Active: Architecture Cleanup Campaign

Source gate: `docs/plans/refactor-architecture-cleanup-campaign.md`
Latest user intent: autonomous repeated verified cleanup slices.

Current slice: ready to commit `plan-bakeoff` report owner split.

Last proof:
- `bun test skills/plan-bakeoff/scripts/run_plan_bakeoff.test.ts` PASS
- `bun run check` PASS
- `git diff --check` PASS

Next proof:
- for next slice, likely `bash -n scripts/update.sh scripts/tasks/*.sh scripts/lib/*.sh`
- focused tests/checks selected after shrinking the candidate

Next candidate: shrink `scripts/tasks/update-cli.sh` by moving the GSD workflow
block to a task-owned internal file without changing update phase order or
public task names.

Parked work:
- Codex config old managed status-line variant migration.
- Hook/config helper deepening until a behavior-preserving seam is clear.
- MiMoCode command-wrapper pruning ownership decision.
- `plan-bakeoff` `base.mode` public manifest-key migration.

Stop condition: after the queue empties, stop only after two fresh discovery
handoffs against current `HEAD` find no clear safe P1/P2 slice after shrink
attempts.
