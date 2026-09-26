# Checkpoints And Auto-Run Policy

Use this reference before whole-flow, durable, worker, or `/goal` runs and
before crossing review, execution, cleanup, or verification boundaries.

Run-control gates (latest user intent, host goal state, scope, external
blockers), the active capsule, execution-surface selection, review cadence, and
proof selection live in [durable run](../../_shared/references/durable-run.md).
Read that first. This file adds the Flow-specific contract gate, stop-gate
discovery, decision triage, and worker supervision.

## Execution Contract Gate

A whole-flow or durable auto-run needs an approved execution contract before it
starts, because everything downstream (handoff, execution, verification)
inherits its scope. Acceptable sources:

- an approved `$intuitive-preflight` contract;
- an equivalent approved contract already reconciled into the canonical plan
  or an issue;
- a tiny direct task whose latest message supplies goal, boundaries,
  verification, and stop condition.

The contract covers goal, scope/non-goals, acceptance, verification, route,
worker strategy when relevant, and stop gate. If a material field is missing,
route to `$intuitive-preflight`; Flow can summarize the gap but does not draft
a second contract.

## Deterministic Stop Gates

Durable runs need a machine-readable way to stop; otherwise a goal keeps
resuming after the work has reached an external-input boundary. At the start of
each whole-flow turn and before each new milestone, run the strongest available
gate:

1. a command named in `STATUS.md`, the active plan, or phase state (for example
   `npm run goal:status` or `make verify-goal`);
2. a package script whose name signals final status (`goal:status`,
   `validate:<milestone>`, `verify:<milestone>`);
3. the canonical artifact that records phase status when no command exists.

Treat a structured result as authoritative:

```json
{ "ok": false, "status": "blocked", "next_action_owner": "human", "required_input": "..." }
```

- `blocked` on truly external input (human records, credentials, hardware,
  private data, paid approval): confirm the evidence is not already present,
  record the gate result in canonical state, then stop or mark the host goal
  blocked. Adjacent docs, validators, or cleanup do not change a blocked end
  state.
- `complete`: audit against the original objective before marking done.
- `continue` or an agent-fixable failure: take the smallest aligned next slice.

Prefer adding a cheap deterministic gate over model judgment for milestones
that end at human review, physical-world proof, or credentials.

## Decision Triage

During a confirmed durable run, classify each question or downstream gate:

| Class | Action |
| --- | --- |
| Soft continuation | Take the recommended/default option, log it briefly, continue |
| Hard stop | Ask once, with the concrete impact |
| Unclear impact | Check repo/docs; if still materially risky, hard stop; otherwise pick the smallest reversible default |
| External-input blocker | Run the stop gate, then stop or mark the goal blocked |

Soft continuations preserve the accepted plan: restating premises already in
the canonical artifact, following an existing repo convention, running normal
review/test/doc sync, applying accepted review findings, or choosing the only
handoff route the evidence supports. A downstream `Confirm`/`Revise` prompt in
this class gets `Confirm` with a one-line rationale.

Hard stops change what the user agreed to: product direction or target user,
scope boundary, public contract or data model, phase split or roadmap
ownership, security/privacy posture, paid or external services, destructive
actions, locked-doc conflicts, more than three new phases, or proof that needs
resources the agent cannot produce.

## Worker Supervision

The main session owns the run contract, route, canonical state, and the final
complete/blocked call. A worker owns one bounded sub-phase and one handoff (see
the [shared delegation policy](../../_shared/references/delegation.md)).

- Phrase a worker-local goal as one sub-phase, not the project:

  ```text
  /goal For parent <root goal>, complete <sub-phase outcome>; update <artifact>; run <proof>; stop with handoff
  ```

- Trust a worker's completion only after inspecting its handoff, changed files,
  commits, and proof. Durable state must exist outside the worker context.
- At each review point, a worker without durable progress, or one pursuing the
  wrong artifact, is steered with a concise correction or stopped and relaunched
  with a narrower goal. Before relaunching, ask whether the original goal was
  too broad and whether the canonical artifact is still right.
- Keep the main session's route memory: prefer a handoff-style `/compact` over
  `/clear` or `/goal clear` during an active durable flow, and re-check the
  canonical artifact afterwards. Close finished workers rather than reusing them.

## Flow Boundaries Worth Pausing At

Most boundaries are soft continuations. These are the ones that are easy to
cross by momentum:

- unsettled value, appetite, or competing bets: route to `$intuitive-shape`;
- plan review to execution or issue/GSD handoff: continue only when execution
  is covered by the request or run contract (see [GSD handoff](gsd-handoff.md)
  for route selection);
- each verified code slice: commit before starting the next slice or cleanup;
- after implementation: run changed-code cleanup before final verification,
  except for docs-only or trivial changes;
- refactor execution: require an accepted P0/P1 checklist and stop condition;
- broad doc moves or deletions outside scope: ask first;
- proof that needs a real simulator, GPU, API keys, Docker, or similar
  unavailable resources: stop at the local-dev gate.
