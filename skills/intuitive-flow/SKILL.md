---
name: intuitive-flow
description: Execute an approved plan or preflight contract, or a tiny bounded change; route discovery and refactors to their owners.
---

# Intuitive Flow

Execute approved plans and tiny concrete changes through the smallest sufficient
route. Preserve the user's objective, existing authorization, and repo conventions.
Prefer reuse, deletion, and consolidation before introducing a new surface.

## Route

| Task | Action |
| --- | --- |
| Tiny bounded edit or read-only check | Work directly; run focused proof. No plan artifact or worker is required. |
| Unsettled product value, appetite, or competing bets | Use $intuitive-shape before planning. |
| Unknown cleanup target | Use $intuitive-reduce-entropy. |
| Selected cleanup seam | Use $intuitive-refactor. |
| Material scope or acceptance decisions remain | Use $intuitive-preflight; reuse decisions already settled in the conversation. |
| Approved plan or durable execution | Implement the full accepted scope, verify, and close out. |

## Read at the relevant boundary

| When | Reference |
| --- | --- |
| Starting or resuming durable execution | [Durable state and ownership](../_shared/references/durable-run.md) and [checkpoints](references/checkpoints-and-auto-run.md) |
| A plan needs intake or reconciliation | [Plan intake](references/plan-intake-and-autoplan.md) |
| Creating or selecting a canonical plan | [Plan selection](../_shared/references/plan-paths.md) |
| Prose check requested, or a long plan handed to another reviewer | [Plan prose shadow check](references/plan-prose-gate.md) |
| Selecting plan/status ownership or phase granularity | [Source of truth](references/source-of-truth.md) |
| Using a GSD phase | [GSD handoff](references/gsd-handoff.md) |
| Repeated blockers, experiments, or self-modification | [Loop guard](references/context-budget-and-loop-guard.md) |
| Closing significant implementation or refactor work | [Docs, commits, and closeout](references/refactor-and-closeout.md) |
| A structured route brief or proof card is needed | [Output shapes](references/output-shapes.md) |

Plan ownership rule: keep an ordinary plan in the target repository's existing
canonical plan surface (normally `docs/plans/<slug>.md`). Planning and review
loops reconcile that file in place; they do not create `.planning/*` or other
GSD artifacts. Use the GSD handoff reference only after an approved execution
contract and an explicit implementation/handoff route.

Load only references needed by the current task. Keep the main session responsible
for scope, integration, and final verification; worker mechanics follow the
shared delegation policy. The main session is not automatically the
project-status integrator.

Respect pause/discuss-only requests. An active goal does not override them, and a
complete or blocked goal is not permission to restart work. Ask only about unresolved
decisions that materially change scope, contracts, risk, or execution permissions.
Continue necessary authorized work until its acceptance gates pass or a concrete
external blocker prevents completion.

For durable implementation or refactor work, auto-commit
each coherent verified owned slice by default. Do not wait for a separate user
request to commit. Stage only owned changes. Skip only for an explicit instruction,
repo prohibition, review-only scope, unsafe overlap, or unresolved blocker; name it.

Closeout reports What changed, Proof, Scope changes, and Parked todos. Do not claim
completion while required product-run, live, or manual proof is missing.
