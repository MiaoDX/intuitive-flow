# Plan, ADR, and glossary updates

Read when accepted answers need recording or the user requests document cleanup.

## Plan vs ADR Routing

Plans and ADRs have different jobs. Use a plan file for execution scope, non-goals, order, files, tests, gates, and
open implementation questions. Use an ADR only for durable decisions future
agents should not relitigate: public contracts, command surfaces, private-data
boundaries, safety policy, architecture layers, rejected alternatives, and
accepted consequences.

Some tasks need both. In that case, keep the ADR short and durable, then let the
plan reference the ADR while owning execution details. Checklists, progress
notes, verification logs, sequencing, local defaults, and decisions the plan
can cheaply reverse all belong in the plan.

Before asking "should this be an ADR?", first state whether the current issue is
contract-shaped or execution-shaped. If it is execution-shaped, default to the
plan file. If it is contract-shaped but the exact public shape is not selected
yet, default to recording the current assumption in the plan and defer the ADR
until the public contract is chosen.

Use [plan selection](../../_shared/references/plan-paths.md) for existing
canonical sources and new plan filenames. Keep accepted decisions in that
source rather than renaming plans or creating a parallel artifact.

Keep ADR numbering for durable decisions with a strict threshold: proof loops,
reruns, local-dev or benchmark evidence, one-off gates, task status, report
wording, artifact regeneration, and reversible details are plan material.

## ADR And Plan Surface Cleanup

When the user's concern is that the repo has too many plans or ADRs, treat that
as a documentation-entropy problem before proposing another decision record.
Classify the existing files into:

- current execution plans;
- stale or superseded plans;
- durable ADRs future agents should obey;
- ADR-shaped execution records, proof logs, rerun notes, or status snapshots.

For plan or ADR overload, default to reversible organization: index/metadata
updates, archive moves for misfiled execution/proof records, and no deletion,
renumbering, gap filling, or broad filename churn unless explicitly accepted.

If the cleanup policy itself is unsettled, ask one focused batch. Once accepted,
implement the cleanup directly instead of repeatedly grilling the same
classification question.

## Documentation Discipline

After each accepted batch:

1. Apply only the resolved `CONTEXT.md` glossary/relationship updates.
2. Keep `CONTEXT.md` free of implementation details, plans, and progress notes.
3. If a plan update is warranted, keep it focused on scope, execution order,
   acceptance gates, verification, and open implementation questions.
4. If an ADR is warranted, create or update it separately with clear context,
   decision, alternatives, and consequences. Link it from the plan when both
   surfaces are needed.
5. If ADR or plan cleanup is warranted, prefer archive moves plus README/index
   updates over deletion, renumbering, or broad filename churn.
6. Report exactly what changed, then run the saturation audit before asking any
   next batch. If the audit finds no more decision-impact questions, stop and
   recommend the next workflow step.

For plan-backed work, prefer updating the existing plan over scattering
resolved decisions through chat. Refresh any existing lifecycle header
concisely; do not add one for tiny local changes.
