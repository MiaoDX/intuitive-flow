# Context Budget And Loop Guard

Use this reference for active-goal resume/debug turns, repeated blockers,
local-hardware probes, long-running verification, or any flow where context
growth is itself becoming a risk.

## Hot Resume

Before Hot Resume, apply the latest user intent gate and host goal gate:

- if the latest user message asks to stop, pause, discuss first, avoid changes,
  or inspect status only, stay read-only and do not resume execution;
- if the host-level goal is `blocked` or `complete`, treat that as a stop gate
  unless the user explicitly asks for a fresh resume.

Hot Resume is the default route only when all are true:

- an active durable run, thread goal, worker handoff, or canonical status file
  already exists;
- a canonical plan/status source already exists;
- the user asks to continue, resume, inspect status, debug a repeated blocker,
  or prevent looping;
- no new product, scope, public-contract, or roadmap decision is requested.

Hot Resume runs before normal route discovery. Do not start by loading the full
skill reference set, full canonical plan, full `STATUS.md`, full logs, large
source files, or large JSON artifacts.

Read only:

1. the task capsule, if one exists
   (`docs/status/active/<plan-slug>.md` for plan-backed runs);
2. `git status --short`;
3. `git log -3 --oneline`;
4. at most one focused machine-readable artifact summary.

If no capsule exists and the run is a non-trivial plan-backed durable run,
create `docs/status/active/<plan-slug>.md` from the current active slice before
implementation. Do not create a same-directory `-process` plan; the source plan
stays canonical and the capsule is only the resume surface. Continue in the
same turn only when the experiment contract is trivial and the next command is
low-risk.

If that low-context check or stop gate says the next required evidence is
blocked on a human action, local hardware, paid account, external service, or
another outside actor, stop immediately with that gate result. Do not expand
context, run route discovery, inspect parked todos, launch workers, or create
small convenience patches to keep the run moving.

## Latest User Intent And Host Goal Gates

The latest user message beats older durable-run state. Stop/pause/discuss-first
phrases are not soft continuation; they convert the turn into read-only control
mode. In that mode, the agent may read compact status, summarize the goal, and
offer next options, but must not launch workers, run tests, modify files, or
commit.

Host-level goals are stop gates when they are no longer active. A `blocked`
goal means the flow has reached a blocker under host policy; a `complete` goal
means the objective has already closed. Do not reinterpret either as permission
to keep making adjacent progress. If the user later asks to resume, start with a
fresh route brief and a new stop gate.

When the host goal is active and the user has asked Flow to run, adopt it as
the main-session root goal. Do not create a second root goal. Create
worker-local goals only inside tmux/`skill-runner` for one bounded sub-phase,
and close or block only that worker goal before returning a handoff to the main
session.

## Context Budgets

Use the smallest budget that can decide the next action.

| Budget | Allowed context |
| --- | --- |
| `low` | Up to four short commands; capsule/status summary; git short state; one focused artifact summary; no large files or extra references. |
| `medium` | One focused source file or one focused plan/status section after explaining why `low` cannot decide. |
| `high` | New planning, broad refactor, unfamiliar repo intake, or route ambiguity only; state why the escalation is necessary. |

Hot Resume defaults to `low`. Escalate only after naming the specific question
that lower context cannot answer.

Prefer `rg`, `jq`, small Python summary snippets, or repo-local summary scripts
over `cat`/`sed` of large files. Do not paste full stderr, full `state.json`,
large test logs, or long generated artifacts into the main session. Summaries
should name the artifact path and the decision it supports.

## Experiment Contract

Before implementation in Hot Resume, emit this contract:

```text
Context budget: <low | medium | high, plus reason if not low>
Current blocker: <one sentence>
Hypothesis: <one falsifiable claim>
Expected decision delta: <what next decision changes if this succeeds/fails>
Command/artifact: <exact command or artifact summary path>
Success means: <observable outcome>
Failure means: <observable outcome and next stop/route>
No-touch scope: <files, subsystems, services, or workflows not touched>
```

If `Expected decision delta` is empty, do not make the change. Read-only
inspection may continue only to form a decision-changing contract.

## Loop Breaker

Track a simple blocker fingerprint in the contract or capsule:

```text
blocker_kind: <stable category, such as isaac_semantic_aov>
root_cause_classification: <current best classification>
last_decision_delta: <what changed last turn>
```

If the same `blocker_kind` appears in two consecutive resume/debug turns without
a changed root-cause classification, the next turn must not make another
low-information observability edit.

Choose one:

- run a root-cause comparison experiment that can change the classification;
- mark/defer the capability as blocked in canonical state and continue a
  different requirement only when the blocker is not the current stop gate's
  next required evidence, or the user explicitly picked that separate
  requirement;
- ask the user for a hard decision.

A change is not aligned progress if it only records more details about the same
blocker without changing the next decision. Observability edits are acceptable
only when they name the decision they can change.

## Local Hardware And External Services

For GPU, simulator, real-device, paid API, private-data, or other external
proofs, keep the main session as the control plane. The probe may run locally,
but the main session should receive a compact result:

```json
{
  "status": "passed|failed|blocked",
  "hypothesis": "...",
  "artifact": "...",
  "decision": "..."
}
```

Do not stream full local logs into the main context unless a short summary is
insufficient to decide the next action.

When the compact result is `blocked` and its decision says the proof depends on
external input, treat it as an auto-stop condition for the root Flow. Report
what must change externally and, when host policy allows, mark the root goal
`blocked`; do not route into adjacent cleanup or parked follow-up work.

## Self-Modification

When the target is this skill or its bundled references/templates, avoid
implementing from inherited momentum. First perform a compact self-audit:

- what existing rule already covers the problem;
- what behavior is still missing;
- the smallest files/sections that need to change;
- how the change will prevent a different future decision.

Patch only after current-turn user permission to make that change. If the user
asked to discuss, inspect, or explain, stop after the audit.

## Execution Surface Guard

For durable implementation, the main session is the control plane. It should
choose routes, inspect artifacts, babysit worker progress, and decide stops.
The execution plane should be a bounded delegated worker by default, selected
through the `$skill-runner` Codex delegation reference.

Main-session direct implementation is allowed only for tiny direct edits,
read-only probes, or local repairs whose route brief explains why context
continuity is not at risk. Otherwise, launch or steer a worker and consume a
compact handoff instead of pulling long logs or full files into the main
session.

## Capsule

For durable local-debug work, maintain a compact capsule under a project-local
status surface such as `docs/status/active/<task>.md` when the repo has one.
For plan-backed durable work, default to
`docs/status/active/<plan-slug>.md`, where `<plan-slug>` is the source plan file
name without `.md`. Use an equivalent task-owned file when the repo does not
have a status surface.

The capsule should contain only:

- source plan path;
- current blocker;
- blocker fingerprint;
- last proven evidence;
- completed slices, summarized in one line each;
- next hypothesis;
- next command/artifact;
- stop condition;
- no-touch scope;
- parked work.

The capsule is a resume accelerator, not a replacement for canonical plans,
status, or verification artifacts. During compact/resume, read the capsule
first and reopen the source plan only for the specific active section or
acceptance criterion the capsule points to. Update canonical source-of-truth
files only when project-level focus, decisions, blockers, verification
expectations, or final plan freshness materially change.
