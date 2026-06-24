# Durable Run Shared Rules

Use this shared reference from any skill that supervises durable execution,
long-running cleanup, repeated resume turns, worker sessions, or verification
selection. It keeps shared run mechanics in one place while each skill keeps
its own domain gate, source plan, and completion criteria.

## First Gates

Apply these gates before reading large context, launching workers, running
tests, or editing files:

- Latest user intent wins over old run state. Stop, pause, status-only, and
  discuss-first language means read-only control mode until the user explicitly
  resumes execution.
- Host goal state is a stop gate when it is `blocked` or `complete`. An active
  host goal is prior intent, not permission to ignore the latest message.
- A canonical plan, issue, refactor gate, or equivalent accepted contract owns
  scope. Do not invent adjacent cleanup because a long run still has budget.
- If the next required proof depends on hardware, credentials, private data,
  paid services, human records, or another outside actor, record that blocker
  and stop instead of switching to unrelated cleanup.

## Active Capsule

For every non-trivial durable run or campaign, maintain a compact active
capsule at:

```text
docs/status/active/<task-slug>.md
```

If `docs/status/active/` does not exist, create it. Do not skip the capsule
because the repo has no existing status directory. Use an equivalent
task-owned file only when repo policy explicitly forbids `docs/status/active/`.

The capsule is a resume surface, not the canonical plan. Keep the canonical
plan, issue, or refactor gate as the source of truth for scope, accepted
checklist, decisions, and final status.

When the repo uses `docs/plans/README.md` as a plan dashboard or puts a
`## Plan Ledger` at the top of plan files, treat those as the session selector.
Before continuing in a shared worktree with multiple active plans, identify the
active plan/session scope and keep edits inside that scope. Cross-plan
dependencies may be linked, but do not reclassify unrelated plans or refresh
their ledgers unless the user explicitly switches scope.

Do not create parallel resume files such as `.continue-here.md` or
`.planning/HANDOFF.json`. If GSD owns the run, update state through GSD tools;
otherwise keep resumable state in the active capsule and canonical plan.

Keep the capsule compact enough to read during a hot resume. It should summarize
state, not preserve history. Do not paste reusable prompts, long command
transcripts, worker raw logs, or every completed slice into the capsule; put
durable history in commits and compact gate summaries.

Include only compact state:

- capsule status (`ACTIVE`, `PARKED`, `BLOCKED`, `DONE`, `SUPERSEDED`, or
  `ABSORBED`);
- source plan/gate/issue path;
- latest user intent classification;
- current slice or blocker;
- blocker fingerprint, if any;
- last proven evidence;
- completed slice batch summary;
- next hypothesis or next slice;
- next proof command/artifact;
- stop condition;
- no-touch scope;
- parked work.

On resume, read the capsule first, then `git status --short`, recent commits,
and at most one focused artifact summary. Reopen the full canonical plan only
when the capsule cannot answer the next-action question.

## Context Budget

Use the smallest context budget that can decide the next action.

| Budget | Allowed context |
| --- | --- |
| `low` | Capsule/status summary, `git status --short`, recent commits, one focused artifact summary, and up to four short commands. |
| `medium` | One focused source file or one focused plan section after naming why `low` cannot decide. |
| `high` | New planning, unfamiliar repo intake, broad architecture uncertainty, or route ambiguity only. |

Hot Resume defaults to `low`. Escalate only after naming the specific decision
that lower context cannot support.

## Control Plane And Workers

The main session is the control plane for durable work. It owns the route,
source-of-truth decisions, active capsule, worker steering, checkpoint review,
and final complete/blocked call.

Use worker sessions for bounded execution phases when the work is long-running,
parallel, stateful, or likely to consume large context. A worker owns one
sub-phase, one artifact/proof target, and one handoff. It must not mark the
main run complete merely because the sub-phase passed.

Choose a review cadence instead of a short hard timeout:

| Task shape | Review cadence |
| --- | --- |
| Tiny or low-risk edit | main session direct, or 10-20 minutes if delegated |
| Normal implementation slice | 30-60 minutes |
| Broad refactor with active tests | 60-120 minutes |
| Known slow proof or migration | align with expected proof checkpoints |

Let a healthy worker continue when it is producing durable progress or running
an expected long proof. At each cadence point, inspect durable state: diff,
commit, artifact, capsule, proof output, or handoff. If none exists, steer,
stop, or relaunch with a narrower goal.

## Checkpoints

Checkpoint the run after each meaningful slice and at least every 60-120
minutes during long campaigns. A checkpoint should leave:

- code/test/docs changes or an explicit parked decision;
- focused proof result or blocked proof reason;
- capsule update with next action and stop condition;
- canonical plan/gate update when scope, status, accepted checklist, or final
  evidence changed;
- semantic commit when the repo/user workflow expects commits.

Do not grow the canonical plan into a per-command transcript. Compress routine
slice details into batch summaries and keep raw logs in artifacts.

## Verification Inventory

Before selecting proof for a durable run or campaign, discover the repo's
available verification layers from local docs and scripts:

- test docs such as `tests/README.md`, `docs/testing*`, or `CONTEXT.md`;
- package scripts, Make targets, CI workflow names, and repo helper scripts;
- typecheck/lint/format commands;
- unit, contract, integration, simulator, visual, browser, hardware, and
  product-run gates;
- known local-only or slow gates and their environment requirements.

Record the useful inventory in the capsule or canonical plan when the run is
long enough that future turns will need the same choice.

## Proof Selector

Choose the smallest sufficient proof by change class, not the largest suite by
reflex. Escalate only when the change class or blast radius requires it.

| Change class | Minimum proof |
| --- | --- |
| Docs, comments, references, generated guidance | Link/search proof plus docs/style check if available. |
| Import-path, alias, dead wrapper, no-caller cleanup | Exact stale-reference search plus focused import/public-surface tests if available. |
| Pure deterministic helper move or duplicate math consolidation | Focused unit tests for old and new owner plus type/static checks. |
| Internal contract migration | Caller tests around the moved contract, owner tests, and static/type checks. |
| Public API, CLI, schema, report, artifact path, persisted data | Contract/golden/schema tests and known caller migration search. |
| Runtime, planner, simulator, visual, browser, external-service, or hardware behavior | The nearest product/harness/manual proof that observes that behavior. |
| Cross-cutting shared infrastructure or test runner behavior | Focused tests plus broader collection/check command that catches import/marker drift. |

Full-suite or expensive harness proof is required only when:

- the accepted contract says so;
- focused proof cannot observe the behavior that may regress;
- the change touches broad shared infrastructure, public routing, runtime
  semantics, simulator/rendering behavior, or artifact credibility;
- prior focused proof revealed unexplained failure or drift.

When skipping an expensive proof, write the reason in proof terms:

```text
Skipped <gate>: <change class> did not alter <behavior/artifact/contract>;
focused proof covered <observable risk>; residual risk is <...>.
```

## Loop Breaker

Track repeated blockers by fingerprint:

```text
blocker_kind: <stable category>
root_cause_classification: <current classification>
last_decision_delta: <what changed last turn>
```

If the same blocker appears in consecutive resume/debug turns without a changed
classification, stop making observability-only edits. Either run an experiment
that can change the classification, mark the blocker in canonical state, or ask
for a decision.
