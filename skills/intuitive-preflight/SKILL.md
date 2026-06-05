---
name: intuitive-preflight
description: |
  Turn a vague task, plan, issue, or "LGTM/go ahead" request into an
  approval-ready preflight contract before implementation starts. Use when the
  user wants prompt preflight, clearer scope, non-goals, context package,
  acceptance criteria, definition of done, verification, stop gates,
  main-session /goal wording, or skill-runner worker prompts for an
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
- naming the main-session `/goal` prompt for long-running supervised work
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
- public contract, API, data model, or compatibility boundary
- scope/non-goal boundary
- required context source, artifact, file, issue, plan, or log
- acceptance criteria or success threshold
- destructive action, broad file movement, or compatibility removal
- paid, credentialed, hardware, Docker, GPU, real simulator, or provider gate

Ask only for hard-stop decisions. If the missing detail is mechanical,
low-risk, reversible, and implied by repo conventions, make it an assumption and
mark when to revisit it.

## Output

Return this shape. Keep it compact enough for the user to approve in one pass.

```text
Preflight status: DRAFT | BLOCKED_NEEDS_DECISION
Task source: <user prompt | plan path | issue | mixed>
Canonical source: <docs/plans/... | issue URL | conversation only>
Route: <main direct | $intuitive-refactor | durable $intuitive-flow | skill-runner worker>

Goal:
<one sentence>

Scope:
- <included work>

Non-goals:
- <explicitly excluded work>

Context package:
- Must read:
  - <canonical files, plans, issues, logs, or artifacts>
- Useful evidence:
  - <optional context that can improve execution>
- Do not read unless needed:
  - <large, stale, noisy, or historical sources>

Definition of Done / acceptance criteria:
- SUCCESS only if:
  - <observable proof>
- PARTIAL if:
  - <useful but incomplete proof>
- BLOCKED_NEEDS_DECISION if:
  - <decision or external gate>
- Must not regress:
  - <existing behavior or contract>

Verification:
- <commands, artifacts, manual checks, or skipped gates with reasons>

Execution surface:
- Main session: <root supervisor role>
- Worker: <none | skill-runner scope>
- Worker-local goal: <none | exact bounded goal>

Main-session /goal prompt:
<include exact prompt text, starting with "/goal", that keeps the main session
as root supervisor and uses $intuitive-flow for route control>

Approval gate:
Reply LGTM, approve, or go ahead to execute; otherwise request edits.
```

The main-session `/goal` prompt should normally say:

```text
/goal
Execute the approved contract for <task>.
Keep this main session as the root supervisor.
Use $intuitive-flow for route control and skill-runner only for bounded workers.
Do not mark complete unless the acceptance criteria pass.
```

If blocked, replace the execution sections with:

```text
Open decisions:
- <question with why it matters>
Recommended default:
- <only when safe; otherwise "none">
```

## Route Rules

Choose the smallest honest route:

| Contract shape | Route |
| --- | --- |
| Read-only diagnosis or one-file/two-file concrete fix | main direct |
| Known cleanup, stale API, compatibility, module layout, or architecture seam | `$intuitive-refactor` |
| Plan-backed, broad, stateful, or multi-stage work | durable `$intuitive-flow` |
| Long-running implementation, review pipeline, GSD, broad refactor, or slow verification | `skill-runner` worker under main-session supervision |

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
