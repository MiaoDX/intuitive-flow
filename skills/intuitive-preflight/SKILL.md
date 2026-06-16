---
name: intuitive-preflight
description: |
  Turn a vague task, plan, issue, or "LGTM/go ahead" request into an
  approval-ready preflight contract before implementation starts. Use when the
  user wants prompt preflight, clearer scope, non-goals, context package,
  acceptance criteria, definition of done, verification, stop gates,
  the exact execution command, or skill-runner worker prompts for an
  intuitive-flow run. This skill does not execute; it produces the contract
  that $intuitive-flow or a main-session goal can execute after approval.
---

# Intuitive Preflight

Use this skill to make execution intent explicit before work starts. The output
is a preflight contract the user can approve, revise, or reject. It is not an
implementation step.

Preflight should make the smallest honest contract approvable. Before allowing
new files, APIs, modules, commands, workers, plans, tests, docs, compatibility
bridges, or persistent workflow surfaces into scope, first test whether the same
observable outcome can be achieved by deleting, merging, narrowing, reusing, or
documenting existing behavior. Record any necessary new entity with its reason
and re-approval trigger.

## Boundary

`$intuitive-preflight` owns scope, non-goals, acceptance criteria, context
packaging, route choice, `/goal execute ... with intuitive-flow` wording, worker
scope, and missing user-owned decisions. It does not execute, create or clear
`/goal`, launch `skill-runner`, edit product files, or approve itself.

After approval, execution normally returns to `$intuitive-flow`. For known
refactor or cleanup preflight contracts, execution may route to
`$intuitive-refactor`.

## When To Stop And Ask

Stop with `BLOCKED_NEEDS_DECISION` instead of drafting a fake-complete contract
when any of these are unclear and materially change the work:

- target user, product intent, or desired behavior
- public contract, API, or data model
- scope/non-goal boundary
- required context source, artifact, file, issue, plan, or log
- acceptance criteria or success threshold
- destructive action or broad file movement
- user-explicit temporary compatibility or migration bridge requirement
- paid, credentialed, hardware, Docker, GPU, real simulator, or provider gate
- any new durable entity whose necessity is unclear or whose addition would
  expand the accepted objective

Ask only for hard-stop decisions. If the missing detail is mechanical,
low-risk, reversible, and implied by repo conventions, make it an assumption and
mark when to revisit it.

## Verification Completeness Rule

Preflight must include every verification gate needed to make the success claim
honest.

Default to requiring all relevant validation layers for the changed behavior:
static/lint/type checks, unit tests, focused contract tests, integration tests,
and manual or local live proof gates when the behavior depends on an agent
pipeline, provider route, simulator, Docker service, hardware, UI interaction,
or other runtime boundary. Do not omit a gate merely because it is local-only,
credentialed, Docker-backed, provider-backed, slow, hardware-dependent, or
requires a real simulator. Instead classify it explicitly:

- required deterministic gate;
- required integration gate;
- required product-run gate;
- required local/live/manual gate;
- optional exploratory gate.

### Runnable Product Proof Rule

Do not stop at code-local tests when the change affects a user-facing run
surface, operator console route, coding-agent workflow, agent prompt/runtime,
MCP server, simulator-backed task, report artifact, or demo contract. The
preflight must name the cheapest public command or manual flow that actually
exercises the changed behavior end to end, then add any higher-fidelity local
or human-only proof needed before claiming success.

For every affected public route or task intent, include at least one product
run gate unless the plan is explicitly docs-only or test-only. If the run needs
credentials, Docker, simulator assets, GPU, hardware, a provider, or human UI
judgment, keep that gate in the contract as local/live/manual proof and mark it
unavailable here when needed.

Required integration, product-run, local/live, and manual acceptance gates are
completion gates, not decoration. If a required gate validates the changed
behavior and cannot run in the current environment, default to
`BLOCKED_NEEDS_LOCAL_VALIDATION` rather than `PARTIAL`; the work may produce an
intermediate branch, but it is not complete, merge-ready, or no-regression until
the required gate passes. Use `INTERMEDIATE_ONLY` only when the user explicitly
asks for or approves an incomplete checkpoint, and state the missing proof and
why it blocks full success.

Preflight itself does not execute tests. It records the gates that execution
must run or explicitly report as unavailable.

## Output

Return a compact contract suitable for pasting into a plan file. Use one-line
fields where possible, `none` for empty items, and short bullets only when a
field would otherwise be unreadable.

```text
Preflight status: <DRAFT | BLOCKED_NEEDS_DECISION | BLOCKED_NEEDS_LOCAL_VALIDATION>
Task source: <user prompt | plan path | issue | mixed>
Canonical source: <docs/plans/... | issue URL | conversation only>
Route: <main direct | $intuitive-refactor | durable $intuitive-flow | delegated worker>
Goal: <one sentence>

Scope: <included work; use short bullets only if needed>
Non-goals: <explicit exclusions>
Entity budget: reuse=<existing surfaces to use>; remove/merge=<existing surfaces to delete, narrow, or consolidate>; new=<only necessary new entities with reason>; expansion triggers=<what requires re-approval>
Context: must-read=<canonical files/plans/issues/logs/artifacts>; useful=<optional evidence>; avoid-unless-needed=<large/stale/noisy/historical sources>

Acceptance:
- SUCCESS: <observable proof, including product run gates for changed public routes>
- BLOCKED_NEEDS_DECISION: <decision or external gate, or none>
- BLOCKED_NEEDS_LOCAL_VALIDATION: <required integration/local/live/manual proof unavailable here, or none>
- INTERMEDIATE_ONLY: <only if explicitly approved; useful incomplete checkpoint, or none>
- No regressions: <existing behavior or contract>

Verification: deterministic=<lint/type/unit/focused contract commands>; integration=<catalog/route/report/artifact commands>; product-run=<public command/flow/script/harness>; local-live-manual=<provider/Docker/simulator/GPU/hardware/browser/human checks, or unavailable reason>; optional=<non-blocking checks>
Execution: main=<root supervisor role>; worker=<none | delegated scope>; worker-goal=<none | exact bounded goal>
To execute: /goal execute <canonical source> with intuitive-flow
Optional tracking: <none | run $multica-goal-tracker create-from-preflight with --preflight-file <file> --workspace-id <workspace> after approval and before executing>
Approval: LGTM/approve/go ahead approves; edits request revision.
```

Use a real durable artifact in `To execute:` when available. If the canonical
source is conversation-only, add one `Plan-file recommendation:` line before
`To execute:` so context compression cannot erase the approved contract. Keep
`Optional tracking` optional unless the user asked for issue tracking; it records
provenance but does not execute or prove completion.

If blocked, replace `Execution`, `To execute`, and `Approval` with:

```text
Open decisions:
- <question> (<why it matters>)
Recommended default: <only when safe; otherwise none>
```

## Route Rules

Choose the smallest honest route: main direct for tiny concrete work,
`$intuitive-refactor` for known cleanup or architecture seams, durable
`$intuitive-flow` for plan-backed/stateful/multi-stage work and delegated
workers for justified parallel read/review/verification scopes or isolated
execution.

When two routes can satisfy the same acceptance criteria, choose the one that
reuses, removes, or narrows existing entities. Do not route to a broader
executor to create room for speculative cleanup, extra planning artifacts, or
new abstractions.

Codex worker selection follows the `$skill-runner` Codex delegation reference.
This skill only records why a worker route is justified for the preflight
contract; the reference owns host-specific mechanics.

Do not use `skill-runner` merely because it exists. Use it when isolated state,
long runtime, worker-local goal, or post-run artifacts will materially improve
control.

## Goal Model

For long-running work, keep the root `/goal` in the main session. The main
session owns route decisions, babysitting, worker inspection, and final
complete/blocked judgment.

Workers may use a worker-local goal only for their assigned bounded scope. A
worker-local goal must not replace, clear, complete, or block the main root
goal.

## Approval Handling

If the user approves a DRAFT preflight contract in the next turn, do not
rewrite the contract unless their approval includes changes. Execute or route
according to the approved contract.

Approval phrases include `LGTM`, `approve`, `go ahead`, `do this`, and
`looks good`. If the user edits the contract, update only affected sections and
show the changed contract before execution when scope, acceptance, route, or
verification changes.
