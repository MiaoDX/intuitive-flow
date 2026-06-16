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

This is the compact runtime entrypoint. Existing detailed behavior is preserved
in `references/detailed-guidance.md`; read it only when the route crosses
multiple stages or the compact gates below do not decide the next action.

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
| Full legacy entrypoint detail | `references/detailed-guidance.md` |

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
  refactors: use durable Flow; run `$intuitive-preflight` first if the current
  plan/conversation lacks context package, scope, non-goals, definition of done,
  verification, route, worker strategy, and root-goal wording.
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
`references/checkpoints-and-auto-run.md` and state the run contract unless the
latest user message already supplies goal, success criteria, stop condition,
boundaries, and tells you to use them as-is.

## Route Brief

Before non-trivial artifacts or edits, show a compact route brief:

```text
Current state:
Latest user intent:
Host goal state:
Goal ownership:
Selected path:
Why:
Bypassed/left behind:
Execution surface:
Babysitter cadence:
Commit rhythm:
Stop gate:
Stop/continue point:
```

For tiny direct work, one sentence is enough. Name plausible but skipped stages
such as `$agent-planning-loop`, `grill-with-docs`, unknown-unknown scouting
with `gstack-autoplan`, `to-issues`, GSD handoff, changed-code cleanup, or
verification.

## Execution Surface

Keep the main session as route owner, integration point, and final verifier.

Codex worker selection follows the `$skill-runner` Codex delegation reference;
do not repeat host-specific worker policy here.

Use the main session for tiny direct edits and read-only probes only when the
route brief names why that is safe for context. For durable multi-stage work,
prefer a control-plane split:

- main session: route, decide, inspect artifacts/diffs/logs, verify claims,
  own the root goal, and synthesize next stage;
- delegated workers: parallel read-heavy scouts, review passes, verification
  probes, or stateful/durable sub-phases according to the canonical delegation
  reference.

Workers may use worker-local goals only for their assigned bounded scope and
must leave the main-session root goal untouched.

## Hard Stops

Stop and ask the user when a choice would materially change product direction,
scope boundary, public contract, data model, roadmap ownership, security,
privacy, paid infrastructure, external-service dependency, destructive action,
broad file moves/deletes, unavailable local hardware/services, or locked
docs/ADRs. Also stop before expanding the accepted objective with a new durable
entity that was not in the approved scope.

If a stop gate says the next required evidence is blocked by a human action,
local hardware, paid account, external service, or another outside actor, stop
instead of looking for adjacent cleanup work. Mark the root goal blocked when
host policy allows.

## Commit And Closeout

Semantic commits are enabled by default for durable implementation/refactor
runs that change local code unless current user/repo instructions disable them.
Commit owned verified slices as the flow progresses; stage only owned files.

Before final closeout for significant implementation/refactor work:

- verify the requested behavior with relevant commands or artifact inspection;
- report a proof card with claim level, commands/checks run, skipped or blocked
  required gates, and artifact paths for any evidence that is not visible in the
  final message;
- run final `$intuitive-doc` alignment for root human docs and `docs/human/**`;
- refresh the source plan status/evidence when plan-backed work shipped;
- triage parked todos and run at most one automatic bounded follow-up slice
  inside the original objective.

Final responses for completed Flow implementation/refactor work must explicitly
include `What changed`, `Proof`, `Scope changes`, and `Parked todos`, even when
empty. Do not claim full completion when a required product-run, local/live, or
manual gate is skipped or blocked.

Read `references/refactor-and-closeout.md` and `references/output-shapes.md`
for detailed commit, doc-alignment, and closeout shapes.
