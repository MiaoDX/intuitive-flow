# Execution contract format

Read when producing an approval-ready preflight artifact.

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
Approval: LGTM/approve/go ahead approves; edits request revision.
```

Use a real durable artifact in `To execute:` when available. If the canonical
source is conversation-only, add one `Plan-file recommendation:` line before
`To execute:` so context compression cannot erase the approved contract.

If blocked, replace `Execution`, `To execute`, and `Approval` with:

```text
Open decisions:
- <question> (<why it matters>)
Recommended default: <only when safe; otherwise none>
```

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
