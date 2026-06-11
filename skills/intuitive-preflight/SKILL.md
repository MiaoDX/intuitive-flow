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

## Boundary

`$intuitive-preflight` owns:

- turning rough intent into scope, non-goals, and acceptance criteria
- packaging the execution context the worker should inspect first: files,
  plans, issues, logs, artifacts, commands, and known non-sources
- deciding the likely route: direct, `$intuitive-refactor`, durable
  `$intuitive-flow`, or `skill-runner`
- naming the exact `/goal execute ... with intuitive-flow` command for
  long-running supervised work
- defining worker prompts and worker-local goals when a bounded worker is useful
- identifying missing user-owned decisions before execution

It does not own:

- executing the task
- creating or clearing `/goal`
- launching `skill-runner`
- editing product files
- approving its own contract

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
- required local/live acceptance gate;
- required manual acceptance gate;
- optional exploratory gate.

### Runnable Product Proof Rule

Do not stop at code-local tests when the change affects a user-facing run
surface, operator console route, coding-agent workflow, agent prompt/runtime,
MCP server, simulator-backed task, report artifact, or demo contract. The
preflight must name the cheapest public command or manual flow that actually
exercises the changed behavior end to end, then add any higher-fidelity local
or human-only proof needed before claiming success.

Use a proof ladder:

1. deterministic gates: lint, type, unit, focused contract tests;
2. integration gates: catalog resolution, route launch construction, report or
   artifact checker tests;
3. product run gates: the public `just ...` command, console flow, script, or
   harness command that drives the changed route;
4. local/live/manual gates: provider-backed, Docker-backed, simulator-backed,
   browser-observed, hardware, GPU, paid, or human-judged proof.

For every affected public route or task intent, include at least one product
run gate unless the plan is explicitly docs-only or test-only. If the task
changes a coding-agent cleanup route, for example, the Verification section
should include an appropriate `just run::surface ... driver=codex intent=cleanup`
or operator-console launch proof in addition to unit tests. If the run requires
credentials, Docker, simulator assets, GPU, hardware, or a human watching the
UI, keep it in the contract as a required local/live or manual acceptance gate
and mark completion `BLOCKED_NEEDS_LOCAL_VALIDATION` when it cannot be run in
the current environment.

Required integration, local/live, and manual acceptance gates are completion
gates, not decoration. If a required gate validates the changed behavior and
cannot run in the current environment, default to
`BLOCKED_NEEDS_LOCAL_VALIDATION` rather than `PARTIAL`; the work may produce an
intermediate branch, but it is not complete, merge-ready, or no-regression until
the required gate passes. Use `INTERMEDIATE_ONLY` only when the user explicitly
asks for or approves an incomplete checkpoint, and state the missing proof and
why it blocks full success.

Preflight itself does not execute tests. It records the gates that execution
must run or explicitly report as unavailable.

## Output

Return a compact contract suitable for pasting into a plan file. Preserve the
same decision semantics, but avoid nested bullets and repeated boilerplate. Use
`none` for empty or non-applicable items. Prefer one-line fields; wrap only when
needed.

```text
Preflight status: <DRAFT | BLOCKED_NEEDS_DECISION | BLOCKED_NEEDS_LOCAL_VALIDATION>
Task source: <user prompt | plan path | issue | mixed>
Canonical source: <docs/plans/... | issue URL | conversation only>
Route: <main direct | $intuitive-refactor | durable $intuitive-flow | Paseo-managed agent | skill-runner worker>
Goal: <one sentence>

Scope: <included work; use short bullets only if needed>
Non-goals: <explicit exclusions>
Context: must-read=<canonical files/plans/issues/logs/artifacts>; useful=<optional evidence>; avoid-unless-needed=<large/stale/noisy/historical sources>

Acceptance:
- SUCCESS: <observable proof, including product run gates for changed public routes>
- BLOCKED_NEEDS_DECISION: <decision or external gate, or none>
- BLOCKED_NEEDS_LOCAL_VALIDATION: <required integration/local/live/manual proof unavailable here, or none>
- INTERMEDIATE_ONLY: <only if explicitly approved; useful incomplete checkpoint, or none>
- No regressions: <existing behavior or contract>

Verification: deterministic=<lint/type/unit/focused contract commands>; integration=<catalog/route/report/artifact commands>; product-run=<public command/flow/script/harness>; local-live-manual=<provider/Docker/simulator/GPU/hardware/browser/human checks, or unavailable reason>; optional=<non-blocking checks>
Execution: main=<root supervisor role>; worker=<none | Paseo scope | skill-runner scope>; worker-goal=<none | exact bounded goal>
To execute: /goal execute <canonical source> with intuitive-flow
Approval: LGTM/approve/go ahead approves; edits request revision.
```

The `To execute` command should normally be the compact durable command:

```text
/goal execute <canonical source> with intuitive-flow
```

Use a real durable artifact when available, for example:

```text
To execute: /goal execute docs/plans/foo.md with intuitive-flow
```

If the canonical source is conversation-only, first recommend writing or
updating a plan file with this contract. Add that as one short
`Plan-file recommendation:` line before `To execute:` so context compression
cannot erase the approved scope and acceptance criteria.

If blocked, replace `Execution`, `To execute`, and `Approval` with:

```text
Open decisions:
- <question> (<why it matters>)
Recommended default: <only when safe; otherwise none>
```

## Route Rules

Choose the smallest honest route:

| Contract shape | Route |
| --- | --- |
| Read-only diagnosis or one-file/two-file concrete fix | main direct |
| Known cleanup, stale API, obsolete compatibility shim, module layout, or architecture seam | `$intuitive-refactor` |
| Plan-backed, broad, stateful, or multi-stage work | durable `$intuitive-flow` |
| Parallel read-heavy scout, review pass, verification/log probe, or short bounded independent task on Codex with probed Paseo MCP | Paseo-managed agent under main-session supervision |
| Long-running implementation, review pipeline, GSD, broad refactor, or slow verification | `skill-runner` worker under main-session supervision |

Do not use a Paseo-managed agent merely because the MCP exists. Use it when the
Paseo provider/model probe succeeds and parallelism or isolated context is
valuable, then inspect `get_agent_activity` plus `get_agent_status` before
trusting the result.

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

Approval phrases include:

- `LGTM`
- `approve`
- `go ahead`
- `do this`
- `looks good`

If the user edits the contract, update only the affected sections and show the
changed contract before execution when the edit changes scope, acceptance,
route, or verification.
