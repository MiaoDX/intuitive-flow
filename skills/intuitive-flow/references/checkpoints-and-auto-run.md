# Checkpoints And Auto-Run Policy

Use this reference before whole-flow, durable, auto-guided, tmux-worker, or
`/goal` runs and before crossing review, GSD, execution, cleanup, or
verification boundaries.

## Execution Contract Gate

Before starting a whole-flow or durable auto-run that may cross review, GSD
handoff, execution, cleanup, and verification, locate the approved execution
contract instead of drafting a second Flow-owned preflight.

Acceptable contract sources:

- an approved `$intuitive-preflight` contract;
- an equivalent approved contract already reconciled into `docs/plans/<slug>.md`
  or an issue;
- a tiny direct task where the latest user message itself supplies goal,
  boundaries, verification, and stop condition.

The contract must cover goal, scope/non-goals, acceptance, verification, route,
worker strategy when relevant, and stop gate. If any material field is missing,
route to `$intuitive-preflight` and stop before unknown-unknown scouting,
`to-issues`, GSD ingest/plan, `skill-runner`, autonomous execution, or
auto-confirming downstream gates. Flow may summarize the missing fields, but it
does not own the approval-ready contract template.

## Latest User Intent Gate

At the start of every whole-flow, resume, worker-babysitting, or closeout turn,
classify the latest user message before reading prior goal state.

| Latest intent | Action |
| --- | --- |
| Execute / continue / resume | Continue through the normal gates. |
| Status / inspect only | Read compact status only; do not execute, edit, or commit. |
| Discuss / plan first | Discuss options and tradeoffs; do not patch or launch workers. |
| Stop / pause / why are you implementing | Stop execution, inspect or update host goal state only when appropriate, and do not resume the prior run. |

This gate has higher priority than auto-continue, worker handoffs, capsules,
GSD phase state, and old run contracts. If the message is ambiguous, choose the
read-only interpretation until the user explicitly asks for execution.

## Host Goal State Gate

When the host exposes a persistent goal tool or equivalent state, check it
before treating a durable run as active:

- `active`: continue only if the latest user intent permits execution;
- `blocked`: do not resume or broaden scope; report the blocker or start a new
  route only after explicit user resume;
- `complete`: do not continue the old objective; treat further work as a fresh
  request;
- unavailable: rely on canonical artifacts and latest user intent.

If the latest user asks to stop/pause and the host policy allows marking the
goal blocked, do that once and then stop. Do not clear or restart the main
session goal just to make progress.

## Goal Ownership Model

Use a parent/child goal shape, not free-form nested goals:

```text
Main session root goal:
  Owns the Flow run contract, route, canonical state, stop gate, babysitting,
  and final complete/blocked decision.

Tmux or skill-runner worker sub-goal:
  Owns one bounded sub-phase, one artifact/proof target, and one handoff.
```

If the main session already has an active root goal when Flow starts, Flow
adopts it. Do not create a second root goal, clear the root goal, or restart the
root goal from the Flow route. If there is no active root goal, Flow may create
one only when the user has requested durable execution and the run contract is
clear.

Worker-local goals are allowed and encouraged for implementation sub-phases,
but they are child scopes. They must:

- name the parent/root goal or route they support;
- cover exactly one sub-phase;
- include the artifact to update and proof to run;
- stop with a compact handoff;
- close or block only the worker-local goal when host policy allows;
- leave the main-session root goal untouched.

The main session reads the worker handoff and decides whether to continue the
root goal, relaunch a narrower worker, change route, complete, or block. A
worker must not mark the root goal complete merely because its sub-phase passed.

## Deterministic Stop Gates

Durable auto-runs need a machine-readable way to stop. Otherwise a goal can keep
resuming after the work has reached an external-input boundary.

At the start of every whole-flow turn and before moving to a new milestone,
discover and run the strongest available stop gate:

1. A command explicitly named in `STATUS.md`, `.planning/STATE.md`, or the
   active phase plan, such as `npm run goal:status`,
   `npm run validate:human`, `make verify-goal`, or a phase-specific verifier.
2. A package/script command whose name suggests final gate status, such as
   `goal:status`, `validate:<milestone>`, `verify:<milestone>`, or
   `check:<milestone>`.
3. A canonical artifact that records current phase status when no command
   exists, such as `.planning/STATE.md`, `.planning/ROADMAP.md`, or
   `STATUS.md`.

Treat the gate as authoritative when it reports a structured result like:

```json
{
  "ok": false,
  "status": "blocked",
  "next_action_owner": "human",
  "required_input": "5 passing human attempt records"
}
```

Also accept the common verifier shape where a non-zero command prints JSON with
`status: "blocked"` or errors that clearly name missing external evidence.

When the stop gate says `blocked`:

- Verify the blocker is truly external: human records, API keys, hardware,
  real-device access, account approval, missing private data, paid service
  approval, or another input the agent cannot honestly create.
- Verify canonical state and current files do not already contain the required
  evidence.
- Record the gate result in canonical state if it is missing or stale.
- Do not continue by inventing adjacent docs, validators, scaffolding, cleanup,
  or extra tests once the mechanical gate and handoff already exist. That kind
  of progress keeps the run alive while preserving the same blocked end state.
- If a host-level persistent goal is active and its blocked-policy threshold is
  satisfied, call the goal status tool with `blocked`. If the host policy does
  not yet allow that, stop the turn with the exact gate result and do not ask the
  user to confirm the obvious external blocker.

When the stop gate says `complete`, perform the completion audit against the
original objective before marking the goal complete. When it says `continue`, or
when it fails for an agent-fixable reason, continue with the smallest aligned
next slice.

Good stop gates are deterministic and cheap. Prefer adding or using them over
model judgment for milestones that end at human review, human testing, physical
world proof, credentials, or other external-state boundaries.

## Resume Capsule

For durable local-debug or active-goal work, maintain a compact capsule under a
project-local status surface such as `docs/status/active/<task>.md` when the
repo has one. Use an equivalent task-owned file when it does not.

The capsule exists to avoid replaying the full workflow on every resume. It
should contain only:

- current blocker;
- blocker fingerprint;
- last proven evidence;
- next hypothesis;
- next command/artifact;
- stop condition;
- no-touch scope;
- parked work.

On resume/debug turns, check the capsule before normal route discovery. If the
capsule and stop gate are enough to choose the next action, stay in Hot Resume
with a low context budget. Escalate to normal route discovery only when the
capsule is missing, stale, contradicted by current evidence, or the user asks
for new planning/review scope.

## Control Plane And Worker Sessions

For durable runs that may cross multiple stages, keep the main session as the
control plane and use `skill-runner`/tmux workers as the execution plane by
default. Main-session direct durable implementation is an exception, not the
default.

Main session responsibilities:

- lock or infer the run contract
- choose the route and next sub-phase
- adopt or create the main-session root goal according to the goal ownership
  model
- keep source-of-truth decisions coherent
- inspect worker artifacts, logs, diffs, commits, and verification evidence
- decide whether to continue, repair, stop, or ask the user

Worker session responsibilities:

- execute one bounded sub-phase
- use a worker-local `/goal` only for that sub-phase when the host supports it
- use `/compact` only inside the worker when needed to preserve progress
- leave durable state before exit: artifact update, verification output, commit,
  or handoff summary
- clear, close, or block only the worker-local goal and exit or stop after the
  handoff

Before choosing main-session direct implementation for anything durable, record
the exception in the route brief:

```text
Execution surface: main session direct
Exception reason: <tiny bounded edit/read-only probe/local repair>
Context risk: <why this will not threaten supervision history>
Fallback: <worker route if it expands or loops>
```

If that exception reason cannot be written plainly, use a worker.

Do not use `/goal clear` or `/clear` in the main session during an active
durable flow. Those commands can remove the route memory and active goal the
main session needs for supervision. If the main session needs context relief,
use a handoff-style `/compact` and immediately re-check the canonical artifact.

Prefer closing a completed worker over clearing it and continuing. A fresh
worker per sub-phase gives cleaner boundaries and makes stale goals less likely.

For goal-driven workers, set a steering cadence, not a short hard timeout.
Choose the cadence per sub-phase from expected proof duration, risk, and
artifact rhythm:

| Task shape | Suggested review cadence |
| --- | --- |
| Tiny or low-risk edit | no worker, or 10-20 minutes if delegated |
| Normal implementation slice | 30-60 minutes |
| Broad refactor with active tests | 60-120 minutes |
| Known slow verification or migration | align with expected proof checkpoints |

Let a healthy long-running worker continue when it is producing durable progress
or running an expected long proof. If the worker is active after a review
interval without durable progress, or if it is pursuing the wrong artifact, the
main session should inspect the captured pane/logs/diff/canonical artifact and
either steer the worker with a follow-up, stop it as blocked, or relaunch a
fresh worker with a narrower corrected goal.

When stopping a bad goal, do not blindly resume. First answer:

- Was the original worker goal too broad, ambiguous, or wrong?
- Is the canonical artifact still the right source of truth?
- Is there a smaller sub-phase that can produce durable evidence?
- Should the next worker use the same skill path, a diagnostic path, or stop for
  user input?

## Decision Triage

During a confirmed durable run, classify each question or downstream gate:

| Class | Action |
| --- | --- |
| Soft continuation | Auto-answer the recommended/default option, log briefly, continue |
| Hard stop | Stop and ask once with concrete impact |
| Unclear impact | Investigate repo/docs context; if still materially risky, hard stop; otherwise choose the smallest reversible default |
| External-input blocker | Run/record the deterministic stop gate, then stop or mark the active goal blocked when host policy allows |

Soft continuation examples:

- preserves the user's accepted plan
- restates premises already present in the canonical artifact
- chooses an existing repo convention
- runs normal review, test, verification, or doc sync
- updates the plan with accepted review findings
- chooses a reversible low-blast-radius default
- selects the only GSD handoff route supported by evidence

Hard-stop examples:

- target user, demand premise, narrowest wedge, product direction
- scope boundary, public contract, data model, phase split, roadmap ownership
- security/privacy posture, paid infrastructure, external service, API key use
- destructive action, real-device/local-dev requirement, or unavailable proof
- locked-doc/ADR conflict, multiple plausible phases, or user intent override
- human/physical-world evidence, credentials, hardware, private data, or paid
  service approval that the agent cannot honestly produce

For unknown-unknown scout premise gates, auto-confirm only when premises restate
the plan or add low-risk assumptions needed for review. Stop when a premise is
new, contradicted by repo evidence, disputed by review voices, or changes
product, scope, contract, security, privacy, cost, data, services, or ownership.

If a downstream skill asks a `Confirm`/`Revise` style question and the gate is a
soft continuation, answer `Confirm` with a one-line rationale instead of waiting
for the user.

For worker-local `/goal` prompts, phrase the goal as one sub-phase, not the full
project. Include the parent/root goal, artifact to update, required proof, and
stop condition.

```text
/goal For parent <root goal>, complete <sub-phase outcome>; update <artifact>; run <proof>; stop with handoff
```

If a worker reports `RECOMMENDED_GOAL_REVISION`, or if the babysitter stops it
for drift/timeout, treat that as evidence for the next route decision. The main
session may revise the worker goal and relaunch only after checking actual
artifacts and diff state.

## GSD Handoff Gates

Auto-continue when exactly one routing row applies:

- existing roadmap phase clearly matches -> `gsd-plan-phase <phase> --prd`
- `.planning/` missing -> manifest + `gsd-ingest-docs --mode new`, inspect
  phase, then `gsd-plan-phase --prd`
- `.planning/` exists and no phase matches -> manifest +
  `gsd-ingest-docs --mode merge`, inspect created/changed phase, then
  `gsd-plan-phase --prd`

Stop for multiple plausible existing phases, more than one new phase, locked
doc conflicts, or changes to roadmap ownership beyond the accepted plan.

## Required Checkpoints

Apply decision triage before crossing these boundaries:

1. Execution contract: require an approved `$intuitive-preflight` contract or an
   equivalent approved execution contract. If missing, route to preflight instead
   of drafting a Flow-specific contract.
2. Idea-shaping route: ask direct vs auto-guided for fuzzy ideas unless already
   clear.
3. Auto-guided user-owned decision: ask before target user, demand premise,
   wedge, scope, public contract, services, cost, phase split, or overrides.
4. Pre-plan -> Review: confirm the plan file is ready for review unless the run
   contract already says to continue.
5. Review -> In-place update: update plan only after approval or soft-continuation
   classification.
6. Review -> Issues/GSD: continue only when execution is covered by the request
   or active run contract.
7. GSD handoff choice: auto-select only with one clear route.
8. Issues -> GSD: ask if GitHub issue tracking vs direct GSD is material.
9. GSD plan -> Execute: continue only when execution is covered by request or
   run contract.
10. Many phases: ask before creating more than three phases.
11. Latest user intent: before every resume, closeout, or worker-babysitting
   turn, classify the newest user message. Stop/status/discuss-first language
   keeps the turn read-only until explicit execution permission returns.
12. Host goal state: if the host goal is `blocked` or `complete`, do not resume
   it as active work. Report the state or start a new route only after explicit
   user instruction.
13. Goal ownership: if a main-session root goal is active, adopt it; if none is
   active, create one only for explicit durable execution with a clear contract.
   Worker goals are child scopes and must not mutate the root goal.
14. Main -> Worker: for durable multi-stage execution, launch a bounded
   `skill-runner`/tmux worker instead of running host-local goal/clear mechanics
   in the main session. For goal-driven workers, choose and record a
   task-adjusted review cadence plus a long enough timeout for the expected
   proof. Direct main-session execution is acceptable only when the route brief
   records the tiny bounded exception and fallback worker route.
15. Worker -> Main: before trusting completion, inspect the worker handoff,
   changed files, logs, commits, and verification evidence. Continue only after
   durable state exists outside the worker context.
16. Worker drift -> Revised worker: if the worker loops, broadens scope, lacks
   durable progress at a review point, or pursues the wrong artifact, inspect
   captured logs and state. Steer the current worker only when a concise
   correction is enough; otherwise stop it and relaunch with a narrower
   corrected goal or stop for a hard decision. Do not keep the same bad goal
   running.
17. Code slice -> Next slice/cleanup: when local code changed and commits are
   enabled, create a semantic slice commit after focused proof before starting
   the next slice or cleanup pass.
18. Changed-code cleanup -> Verify: skip only for docs-only/trivial changes or
   explicit user instruction.
19. Refactor scope -> Execute: require accepted P0/P1 checklist and stop
   condition.
20. Refactor doc cleanup: auto-run focused doc status; ask before broad
   moves/deletions or protected docs outside scope.
21. Local-dev gate: stop when proof needs real simulator, Gateway, VLM, Docker,
   GPU, API keys, or similar unavailable resources.
22. External-input stop gate: when the current milestone requires human records,
   credentials, hardware, private data, paid approval, or other non-agent-owned
   evidence, run the deterministic stop gate. If it reports the same blocker
   recorded in canonical state and no new evidence exists, stop or mark the
   active goal blocked according to host goal rules. Do not keep the flow alive
   with tangential cleanup.
