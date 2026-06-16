---
name: intuitive-flow
description: |
  Stable execution/change router after an approved plan, preflight contract, or
  tiny concrete task. Refactor-shaped work delegates to intuitive-refactor, and
  durable work runs through staged planning, review, GSD handoff,
  implementation, cleanup, and verification. Also accept vague prompts as a
  compatibility route that names the upstream planning stage instead of hiding
  planning inside execution.
---

# Intuitive Flow

`$intuitive-flow` is the stable build/change entrypoint. Accept the trigger,
then choose the smallest executor that preserves source-of-truth clarity,
verification, and stop gates.

Default to less. Before recommending or implementing a new file, API, module,
workflow, test layer, worker, plan, or compatibility surface, check whether the
same user-visible outcome can be reached by narrowing scope, deleting stale
surface, merging duplicate behavior, reusing an existing route, or documenting
current truth. Add a new entity only when that smaller option cannot satisfy the
accepted behavior and proof gate.

This is the compact runtime entrypoint. Use the `Read First` table below to load
the narrow reference needed for the selected route.

## Modes

| Mode | Use when | Output | Redirect when |
| --- | --- | --- | --- |
| Direct route | Status checks, diagnostics, or tiny concrete edits are bounded enough for the main session. | Short route note, focused proof, and concise closeout. | The task is really discovery, refactor scope, or preflight. |
| Planning route | The user has a fuzzy idea, draft plan, or wants agents to align before execution. | Upstream recommendation through reduce-entropy, planning loop, grill-batch, or preflight. | The plan is already approved and execution-ready. |
| Durable execution | An approved plan/preflight/phase needs implementation, verification, docs, commits, and closeout. | Route brief, staged execution, proof card, docs alignment, parked todos. | The task is a known refactor seam or changed-code cleanup. |

For non-trivial runs, state `Selected mode:`, `Why:`, and `Redirect:` before
the first artifact or edit. For tiny direct work, one sentence can carry the
same information. Add a final `Mode note:` only when the user manually invoked
this skill, the request was ambiguous, or another mode/skill would fit better.

## First Gates

Before reading more context, launching workers, or editing files:

1. Treat the latest user message as authoritative.
   Stop/pause/status-only/discuss-first language means read-only control mode
   until a later message explicitly resumes execution.
2. Check host goal state when available.
   A `blocked` or `complete` goal is a stop gate, not a resume cue. An active
   goal is prior intent, not permission to override the latest user message.
3. If this is an active-goal resume/debug turn, use Hot Resume:
   read only the task capsule if any, `git status --short`, `git log -3
   --oneline`, and at most one focused machine-readable artifact summary.
4. When changing `intuitive-flow` itself, audit first and patch only the named
   smallest delta after current-turn user permission.

For durable or resumed runs, read `references/context-budget-and-loop-guard.md`
before deciding whether to continue, relaunch, or stop.

## Read First

Load only the reference needed for the selected route:

| Need | Read |
| --- | --- |
| Active-goal resume/debug, context budget, loop breaker, experiment contract | `references/context-budget-and-loop-guard.md` |
| Source-of-truth, `STATUS.md`, `CONTEXT.md`, provenance, phase granularity | `references/source-of-truth.md` |
| Fuzzy idea shaping, single plan-file intake, unknown-unknown scout/reconciliation | `references/plan-intake-and-autoplan.md` |
| GSD ingest vs plan-phase routing, committed phase execution, changed-code cleanup scope | `references/gsd-handoff.md` |
| Whole-run preflight, goal ownership, soft continuation vs hard stop, checkpoint policy, tmux/goal/clear policy | `references/checkpoints-and-auto-run.md` |
| Broad refactor route, semantic commits, final `$intuitive-doc` doc-alignment sub-phase, parked-todo closeout | `references/refactor-and-closeout.md` |
| Exact response and artifact templates | `references/output-shapes.md` and `templates/` |
| Reference index | `references/detailed-guidance.md` |

If a route crosses multiple concerns, read the next reference just before that
boundary. Do not preload every reference.

## Route Selection

- Routing precedence for overlapping prompts:
  unknown owner or "what should we clean" -> `$intuitive-reduce-entropy`;
  known code/API/module seam -> `$intuitive-refactor`;
  accepted direction without an execution contract -> `$intuitive-preflight`;
  approved execution contract or tiny concrete task -> `$intuitive-flow`.
- Read-only diagnostics, status checks, and tiny concrete fixes: stay in the
  main session with a short route note and focused evidence.
- Refactor, cleanup, stale API, compatibility, module layout, or known
  architecture work: route to `$intuitive-refactor` for accepted severities,
  evidence ladder, and stop condition.
- Vague tasks, plan-backed work, broad durable implementation, or long-running
  refactors: use durable Flow only after an approved `$intuitive-preflight`
  contract or equivalent approved execution contract exists. If the current
  plan/conversation lacks context package, scope, non-goals, definition of done,
  verification, route, worker strategy, and root-goal wording, route to
  `$intuitive-preflight` instead of drafting a second Flow contract.
- Plan-backed implementation must have an approved preflight contract plus an
  explicit unknown-unknown scout result or skip reason in the canonical plan,
  unless the task is tiny direct work that is not using a plan as source of
  truth.
- Changed-code cleanup: use `$intuitive-refactor` changed-code review on the
  changed scope, then rerun relevant proof.

When the route is ambiguous, prefer the path that removes or reuses existing
entities over the path that adds a new one. If a proposal adds an entity, name
the existing surfaces considered and why they are insufficient.

For whole-flow or durable auto-runs, read
`references/checkpoints-and-auto-run.md` and identify the approved execution
contract. If none exists, route to `$intuitive-preflight`; do not maintain a
separate Flow-owned contract prompt.

## Route Brief

Before non-trivial artifacts or edits, show a compact route brief. The full
shape lives in `templates/route-brief.md`; keep it short and route-specific.

```text
Current state:
Latest user intent:
Host goal state:
Goal ownership:
Selected path:
Why:
Bypassed/left behind:
Execution surface:
Stop gate:
Stop/continue point:
```

For tiny direct work, one sentence is enough. Name plausible but skipped stages
such as `$agent-planning-loop`, `grill-with-docs`, unknown-unknown scouting
with `gstack-autoplan`, `to-issues`, GSD handoff, changed-code cleanup, or
verification.

## Execution Surface

Keep the main session as route owner, integration point, and final verifier.
Use main-session edits for tiny direct work. For durable, stateful, long-running,
or parallel work, read `references/checkpoints-and-auto-run.md` and the
`$skill-runner` Codex delegation reference before launching workers.

## Hard Stops

Stop and ask the user when a choice would materially change product direction,
scope boundary, public contract, data model, roadmap ownership, security,
privacy, paid infrastructure, external-service dependency, destructive action,
broad file moves/deletes, unavailable local hardware/services, or locked
docs/ADRs. Also stop before expanding the accepted objective with a new durable
entity that was not in the approved scope.

If the next required evidence is blocked by a human action, local hardware, paid
account, external service, or another outside actor, stop instead of looking for
adjacent cleanup work.

## Commit And Closeout

For significant implementation/refactor work, use
`references/refactor-and-closeout.md` and `references/output-shapes.md` for
semantic commits, final `$intuitive-doc` alignment, plan status updates, proof
cards, and parked-todo closeout.

Final responses for completed Flow implementation/refactor work must explicitly
include `What changed`, `Proof`, `Scope changes`, and `Parked todos`, even when
empty. Do not claim full completion when a required product-run, local/live, or
manual gate is skipped or blocked.
