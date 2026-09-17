# Intuitive Flow Detailed Guidance

This file is an index. Read only the reference needed for the selected route:

| Need | Read |
| --- | --- |
| Shared durable-run mechanics, Hot Resume, active capsule, control-plane/worker cadence, proof selector | ../../_shared/references/durable-run.md |
| Flow-specific blocker experiment contract, self-modification guard, loop diagnostics | [context-budget-and-loop-guard.md](context-budget-and-loop-guard.md) |
| Source-of-truth, STATUS.md, CONTEXT.md, provenance, phase granularity | [source-of-truth.md](source-of-truth.md) |
| Fuzzy idea shaping, single plan-file intake, unknown-unknown scout/reconciliation | [plan-intake-and-autoplan.md](plan-intake-and-autoplan.md) |
| Final plan prose check after decision reconciliation and before preflight or handoff | [plan-prose-gate.md](plan-prose-gate.md) |
| GSD ingest vs plan-phase routing, committed phase execution, changed-code cleanup scope | [gsd-handoff.md](gsd-handoff.md) |
| Whole-run preflight, goal ownership, soft continuation vs hard stop, checkpoint policy, tmux/goal/clear policy | [checkpoints-and-auto-run.md](checkpoints-and-auto-run.md) |
| Broad refactor route, semantic commits, final $intuitive-doc doc-alignment sub-phase, parked-todo closeout | [refactor-and-closeout.md](refactor-and-closeout.md) |
| Exact response and artifact templates | [output-shapes.md](output-shapes.md) and [templates](../templates/) |

Keep SKILL.md as the runtime router and load the narrow reference at the boundary where it becomes relevant.
