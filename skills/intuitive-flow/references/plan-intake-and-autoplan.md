# Plan Intake And Autoplan

Use this reference for fuzzy ideas, plan-like markdown intake, and any request
to implement from a plan.

## Planning Route

Choose the owner from the unresolved decision; do not ask the user to choose a
workflow menu or repeat settled decisions.

| Need | Owner |
| --- | --- |
| Whether to build, target audience, demand, appetite, or competing bets | $intuitive-shape |
| Blind spots or weak assumptions in an idea or draft plan | $intuitive-reduce-entropy in plan entropy mode |
| Requested multi-agent debate or alignment | $agent-planning-loop |
| Remaining domain or contract questions against docs | $grill-with-docs-batch |
| Execution scope, acceptance, verification, or route | $intuitive-preflight |
| Settled tiny change or approved execution contract | $intuitive-flow |

Shape owns product framing; Flow does not maintain a second inline shaping mode.
Preserve Shape's appetite, no-gos, ordered cuts, and circuit breaker in the
canonical plan or preflight. A BET can proceed to planning; RESEARCH routes only
the bounded probe, RESHAPE returns to the unsettled decision, and PASS stops
without creating a plan or backlog item. The terminal decision and user intent
control whether there is any executable handoff.

An explicit request to choose defaults changes decision handling, not ownership.
Resolve reversible implementation details from repo evidence, and ask only for
material user-owned decisions. A plan-only request ends at the plan checkpoint;
continue into execution when the existing request authorizes it.

## Single Plan-File Intake

Use [plan selection](../../_shared/references/plan-paths.md) to resolve the
canonical source. Preserve a supplied execution-ready plan or issue at its
existing location. Read `source-of-truth.md` for stage ownership and provenance.
Every plan path below is an example of the selected source, not a migration gate.

When a repository follows the usual plan-file convention, a new ordinary plan
request resolves to one `docs/plans/<slug>.md` file. Keep the planning loop,
scout findings, and accepted decisions attached to that canonical file. A
planning-only request ends at that plan checkpoint; do not create or mutate
`.planning/*`, `ROADMAP.md`, `STATE.md`, or a GSD phase merely because the user
mentions GSD, agents, or planning. Preserve a repository's explicit existing
convention when it uses another canonical path.

Pre-plan contents:

- plan ledger near the top
- problem / goal
- shaped-bet constraints when Shape ran
- decisions already made
- non-goals
- smallest demo and fuller demo
- success criteria and acceptance criteria
- proposed vertical slices
- verification expectations
- GSD handoff trigger
- source evidence links

Use `../templates/pre-plan.md` when drafting a new plan.

When drafting or revising `docs/plans/<slug>.md`, follow
`source-of-truth.md`'s Plan Ledger And Dashboard rules: set the session scope,
record parent/child relationships, name the no-touch boundary, and update the
existing plan dashboard when the plan set or next action changes. If multiple
plans exist, do not update unrelated plan ledgers while shaping this one.

## Risk-Triggered Unknown-Unknown Scout

Use an unknown-unknown scout during planning only when the plan is broad,
risky, cross-cutting, or likely to hide material DX, test, sequencing, or
execution concerns. `gstack-autoplan` is one option. It is not an
implementation tool or a mandatory execution gate.

Do not run or record skip metadata for ordinary work when the accepted plan and
preflight already cover the relevant risks. Reuse a fresh reconciled scout
result when one exists.

If the scout runs, use:

```text
gstack-autoplan docs/plans/<slug>.md
```

For whole-flow, review-heavy, or long-running scout runs, use the host-approved
worker route when isolation or recovery adds value so the main session can
supervise and inspect artifacts before reconciliation.

When a scout is required, treat as `autoplan` evidence:

- the canonical plan contains accepted review decisions for scope, risks, tests,
  DX, and execution, or links a review summary while keeping decisions in the
  plan body
- recent conversation or repo history explicitly shows `autoplan` ran and the
  plan was updated in place afterward

Do not treat as evidence:

- the user saying "LGTM", "approved", "go implement", or "keep this plan"
- a commit containing the plan without visible review/update
- raw `~/.gstack` review logs, restore files, or final-gate summaries that were
  not reconciled into the canonical plan

When a scout runs, report its result in the planning stage:

```text
Unknown-unknown scout: run
Reason: <material risk that triggered it>
Findings:
- accepted into plan: <items or none>
- requires grill decision: <items or none>
- parked: <items or none>
- no material findings: <yes/no>
Canonical plan updated: <yes/no>
```

## Autoplan Reconciliation

`gstack-autoplan` is a review pipeline, not an implementation tool. It may
refine scope, risks, tests, DX, and sequencing, but must not start coding.

When review is approved or classified as a soft continuation:

1. Update the canonical plan in place with accepted decisions.
2. Keep or link external `~/.gstack` artifacts only as evidence.
3. Verify the plan body contains accepted acceptance criteria and GSD handoff.
4. Surface scope changes before execution.

The loop remains a plan review step. It is not a GSD handoff and must not
manufacture GSD-owned artifacts. Route to GSD only after the canonical plan has
an approved execution contract and the user requests implementation/handoff (or
an existing GSD phase already owns execution); then follow
`gsd-handoff.md` and invoke the named GSD skill.

If the only repo change after review is a restore comment or appended review
report, do not hand off yet. First edit the plan body so the next stage ingests
the approved plan, not the review artifact.

Unknown-unknown scout scope-change hint before implementation:

```text
Scout scope changes: <none | accepted changes | hard-stop changes>
Accepted into plan: <short bullets or "none">
Parked/deferred from scout: <short bullets or "none">
Hard-stop decisions still needing user input: <short bullets or "none">
```

Treat new/disputed product scope, public contracts, security/privacy posture,
paid services, data model changes, phase ownership changes, or incompatible
requirements as hard stops. Treat clarified tests, implementation sequencing,
DX cleanup, and risk notes that preserve original intent as accepted updates
once reconciled into the plan.

## Plan Prose Finalization

The prose gate is opt-in during its trial. Run it (see `plan-prose-gate.md`)
after the last content-changing planning stage when the user asks for a prose
check, or when a long plan will be handed to another agent or a human reviewer.
It reports outside the plan and never rewrites it; rerun it if the plan body
changes materially before handoff. A missing optional deterministic helper
reports `score=unavailable; record=unavailable`; it does not block a target repo
or justify adding Bun there.

The prose gate owns form only. It must not approve the plan, change protected
contract sections, or substitute a low lint score for scope, acceptance,
verification, or execution-readiness review.

## Plan-Backed Execution Gate

When the user asks to implement a specific plan, says "LGTM", says "impl" while
pointing at a plan, or approves a plan-backed run, first resolve the selected canonical
plan or issue and read its `Plan Ledger` if present so the run is
locked to one session scope. Before implementation edits, read the plan's
referenced context files. If the repo has `CONTEXT-MAP.md`, use it to find the
relevant `CONTEXT.md` section; otherwise read root `CONTEXT.md` when the plan
depends on domain terms, durable boundaries, public/private data rules,
MCP/tool contracts, command surfaces, safety policy, or acceptance criteria.

Plan-backed Flow execution may start only when the canonical plan records:

- accepted scope, non-goals, acceptance criteria, verification, route, and stop
  gates;
- an approved `$intuitive-preflight` contract or an equivalent approved
  execution contract reconciled into the plan;
- a reconciled scout result when preflight identified a material
  unknown-unknown risk;
- no unresolved hard-stop grill or required-scout decisions.

If this evidence is missing, classify the state as `Draft Plan Exists` or
`Needs Preflight` and route upstream. Do not run `gstack-autoplan` as a hidden
execution precheck merely because the user approved implementation. Say which
planning-stage evidence is missing and what artifact must be updated before
Flow execution.
