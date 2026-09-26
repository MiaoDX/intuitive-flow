# Context Budget And Loop Guard

Use this reference for active-goal resume/debug turns, repeated blockers,
local-hardware probes, long-running verification, or any flow where context
growth is itself becoming a risk.

Run-control gates (latest user intent, host goal state, scope, external
blockers), context budgets, the active capsule, and the loop breaker live in
[durable run](../../_shared/references/durable-run.md). Apply its First Gates
before anything here. This file adds the Flow-specific Hot Resume route, the
experiment contract, and the self-modification guard.

## Hot Resume

Hot Resume is the default route when an active durable run, goal, worker
handoff, or canonical status file already exists, the user asks to continue,
resume, inspect status, or debug a repeated blocker, and no new product, scope,
or contract decision is requested.

It runs before normal route discovery and starts at the `low` context budget:
the task-owned state (or the host/session resume summary when repo artifacts
are forbidden), `git status --short`, `git log -3 --oneline`, and at most one
focused artifact summary. Loading the full plan, logs, or reference set first
is what makes resumed runs drift, so escalate only when the low budget cannot
decide the next action.

If no capsule exists and the run is a non-trivial plan-backed durable run,
apply the shared task-state selector. Create a capsule from the current active
slice only when it selects a repo artifact. When it selects host/session
persistence, keep the compact resume summary there and report reduced
cross-session durability; do not create a file. The source plan stays
canonical, so no same-directory `-process` plan is needed.

If the low-context check shows the next required evidence is blocked on an
outside actor, stop with that result (see the shared external-blocker gate).

## Experiment Contract

In Hot Resume, record the experiment in the capsule so the turn is aimed at
changing a decision rather than at producing activity:

```text
Current blocker: <one sentence>
Hypothesis: <one falsifiable claim>
Expected decision delta: <what next decision changes if this succeeds/fails>
Command/artifact: <exact command or artifact summary path>
Success means / Failure means: <observable outcomes and next route>
No-touch scope: <what is not touched>
```

If the expected decision delta is empty, keep reading until one exists or stop.
Repeated blockers follow the shared loop breaker: a change that only records
more detail about the same blocker is not progress unless it names the decision
it can change.

## Local Hardware And External Services

For GPU, simulator, real-device, paid API, private-data, or other external
proofs, the probe may run locally but the main session should receive a compact
result (status, hypothesis, artifact path, decision) rather than full logs. A
`blocked` result that depends on external input ends the run under the shared
external-blocker gate.

## Self-Modification

When the target is this skill or its bundled references, start with a short
self-audit: which existing rule already covers the problem, what behavior is
still missing, the smallest section to change, and how the change alters a
future decision. Patch only with current-turn permission; if the user asked to
discuss or inspect, stop after the audit.

## Context Hygiene

Prefer `rg`, `jq`, short snippets, or repo-local summary scripts over full-file
dumps for large plans, logs, or generated artifacts. Summaries name the artifact
path and the decision it supports. Bounded sequential work may stay in the main
session; delegate only when isolation, recovery, or parallelism is a concrete
benefit.
