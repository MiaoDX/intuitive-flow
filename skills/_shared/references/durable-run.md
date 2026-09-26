# Durable Run Shared Rules

Use this shared reference from any skill that supervises durable execution,
long-running cleanup, repeated resume turns, worker sessions, or verification
selection. It keeps shared run mechanics in one place while each skill keeps
its own domain gate, source plan, and completion criteria.

## First Gates

This section is the single canonical copy of the run-control gates. Other
references link here instead of restating them.

Apply these before reading large context, launching workers, running tests, or
editing files:

- **Latest user intent wins over old run state.** A durable run remembers what
  the user wanted earlier; the latest message says what they want now.
  Execute/continue/resume proceeds through the normal gates. Status-only,
  discuss-first, stop, or pause means read-only control mode: summarize state
  and options, but do not edit, run workers, or commit until the user resumes.
- **Host goal state is prior intent, not permission.** An `active` host goal
  continues only when the latest message allows execution. `blocked` or
  `complete` ends the old objective; further work is a fresh request. The main
  session adopts an existing root goal rather than creating a second one;
  workers may hold only a child goal for their own sub-phase.
- **The accepted contract owns scope.** A canonical plan, issue, refactor gate,
  or equivalent accepted contract decides what is in scope. Remaining budget is
  not a reason to add adjacent cleanup.
- **External blockers end the run.** If the next required proof depends on
  hardware, credentials, private data, paid services, human records, or another
  outside actor, record the blocker and stop. Work that only keeps the run busy
  without changing that blocker is not progress.

## Target-Repo State Discovery

Repo-local guidance and existing source-of-truth conventions win over Intuitive
defaults. Before creating or editing status artifacts, inspect `AGENTS.md`,
`CLAUDE.md`, current human docs, existing plan/issue state, and nearby resume
artifacts for an explicit project-status surface and task-owned state path.

Treat project status as optional. An existing `STATUS.md` or explicitly named
equivalent may be integrated under the ownership rules below. Its absence is
normal: running an Intuitive skill is not a reason to create one.

For plan paths, use [plan selection](plan-paths.md); task resume state is
selected separately below.

## Active Capsule

For every non-trivial durable run or campaign, maintain compact task-owned
resume state. Select its location in this order:

1. the repo-defined task/resume surface;
2. an already adopted `docs/status/active/<task-slug>.md` convention;
3. the default path below when repo artifacts may be created;
4. available host/session persistence when repo policy forbids a task artifact.

The default path is:

```text
docs/status/active/<task-slug>.md
```

Create the default directory only in case 3. In case 4, report explicitly that
repository-level cross-session resume is unavailable rather than inventing
another committed path. In the rules below, `active capsule` means whichever task-owned
surface this selection produced.

The capsule is a resume surface, not the canonical plan. Keep the canonical
plan, issue, or refactor gate as the source of truth for scope, accepted
checklist, decisions, and final status.

When the repo uses `docs/plans/README.md` as a plan dashboard or puts a
`## Plan Ledger` at the top of plan files, treat those as the session selector.
Before continuing in a shared worktree with multiple active plans, identify the
active plan/session scope and keep edits inside that scope. Cross-plan
dependencies may be linked; unrelated plans and their ledgers change only after
the user explicitly switches scope.

Resumable state lives in one place: GSD tools when GSD owns the run, otherwise
the active capsule and canonical plan, with no parallel `.continue-here.md` or
`.planning/HANDOFF.json`.

Keep the capsule compact enough to read during a hot resume. It should summarize
state, not preserve history; reusable prompts, command transcripts, raw worker
logs, and completed-slice lists go to commits and compact gate summaries.

Maintain the capsule by replacing stale state, not by appending dated blocks.
When a new slice changes the objective, blocker, next action, or proof boundary,
rewrite the relevant fields into the current truth and delete superseded prose.
If history matters, link one result note or commit instead of keeping the story
inline. A hot-resume capsule that no longer fits in one focused read is a
maintenance bug; compact it before continuing the durable run.

Include only compact state:

- capsule status (`ACTIVE`, `PARKED`, or `BLOCKED` while it remains in the
  target repo's active namespace);
- source plan/gate/issue path;
- current task control plane identity or stable session label;
- project-status writer identity when one is explicitly assigned;
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

On `DONE`, `SUPERSEDED`, or `ABSORBED`, first reconcile final status, evidence,
remaining work, and links in the canonical plan, issue, gate, closeout, or local
equivalent. Then remove the capsule from the active namespace. Delete it by
default; when the repo already requires retained audit/history artifacts, move
it to that existing non-active surface instead of creating a new archive
convention. Migrate legacy terminal capsules only when a run resumes, closes,
or an explicit initializer refresh owns that migration; skill installation
must not rewrite target repos.

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

Use three distinct roles:

- **Project integrator:** the only writer of a shared project-status surface.
  In a coordinated multi-task run this is the umbrella session. Without an
  explicit integrator, task sessions return a project-status delta and leave
  shared status unchanged.
- **Task control plane:** the main session for one durable task. It is the sole
  writer of that task's capsule and canonical task state and owns routing,
  worker steering, checkpoint review, and the task's final complete/blocked
  call.
- **Worker:** owns one bounded implementation or proof target and returns a
  structured handoff. It does not edit project status, the task capsule, plan
  ledgers, or final task state unless explicitly promoted to task control plane.

A standalone main session may hold both integrator roles only when user intent,
repo guidance, or the coordinated run makes that authority explicit. If another
writer is active or ownership is ambiguous, stop status mutation. To transfer
task ownership, stop the prior control plane and record the new owner in the
capsule before work resumes.

This is cooperative ownership, not a filesystem lock. The user, umbrella
session, or host orchestrator must assign one task control plane before
coordinated workers start. When an existing capsule or host activity exposes a
different owner, stop. Two fully independent processes that start
simultaneously without shared coordination cannot be made mutually exclusive by
this contract, and reports should say so.

### Execution Surface Selection

Use the main session directly for bounded sequential work, including multi-step
or durable tasks, when scope and context remain manageable. Keep the same
canonical state, proof, and checkpoint obligations; no exception is required.

Delegate only when independent parallel work, context isolation, durable worker
logs, or recovery across sessions provides a concrete benefit and host policy
permits it. Name that benefit and give each worker one bounded sub-phase,
artifact/proof target, and handoff. A long task or a plan file alone does not
require a worker. If delegation is unavailable, execute directly when feasible;
otherwise report the actual capability needed. Only the main session marks the
run complete; a passing sub-phase is evidence toward that call.

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

Keep the canonical plan a contract, not a per-command transcript: compress routine
slice details into batch summaries and keep raw logs in artifacts.
At each checkpoint, also check whether the plan ledger or active capsule has
started to drift into a timeline. If so, replace the timeline with the current
objective, latest evidence link, remaining gate, and no-touch scope before
launching the next slice.

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
