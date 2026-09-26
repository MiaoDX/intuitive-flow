# Source Of Truth And Provenance

Use this reference whenever a route creates, promotes, or consumes planning
artifacts. Use [plan selection](../../_shared/references/plan-paths.md) for
canonical sources and new filenames; the paths below are Intuitive defaults,
and the repo's existing convention wins.

## Stage Source Of Truth

Each stage has one authoritative artifact family, updated in place at handoff:

| Stage | Source of truth |
| --- | --- |
| Before committed execution | `docs/plans/<slug>.md` or GitHub issues |
| During execution | The selected plan or issue plus task resume state; GSD-owned `.planning/*` when GSD runs |
| After shipping | Verification reports, summaries, retrospectives, closeout notes |

Review logs, restore files, chat history, and temporary notes are evidence.

In the default layout `docs/plans/` is flat: one plan per file. Lifecycle lives
in each plan's ledger and status fields (status, last reviewed, shipped
evidence, remaining gates, superseded-by links) rather than in `active/` or
`archive/` subdirectories. Current execution progress lives in
`docs/status/active/<task-slug>.md`.

## Plan Ledger And Dashboard

A plan keeps a compact `## Plan Ledger` near the top so an agent in a shared
worktree can tell which session it is in before reading the whole plan
(reuse the repo's wording when it already has one):

```markdown
## Plan Ledger

- Plan status: ACTIVE | PARKED | PROPOSED | DONE | SUPERSEDED
- Session scope: short-session-name
- Parent plan / Child plans: paths or none
- Last updated: YYYY-MM-DD
- Current slice: one or two lines
- Next action: one concrete next step
- Blocked on: blocker or none
- Do not touch from this session: unrelated plans/files
```

`docs/plans/README.md`, when present, is an index of plans with enough session
scope to pick one; update its row when a plan's status, scope, relations, next
action, or blocker changes.

Plans are maintained by replacement: when the truth changes, rewrite the
ledger, dashboard row, and contract in place and delete superseded next
actions, gates, and blocker prose. One objective, one next gate, one blocker
summary, and links to evidence keep a plan readable; compact it when agents
must read history to find the next action.

With several active plans, lock the run to the plan named by the prompt,
dashboard, ledger, or active capsule, and edit only that plan and its accepted
scope. Other plans can be linked as dependencies; a plan that looks stale is
reported as an observation or handled after an explicit session switch.

## Plan-Like Intake

Accept a user-selected execution-ready plan, issue, or GSD artifact at its
existing path. When an ADR or reference doc supplies decisions but is not an
execution plan, reuse or create a plan (goal, scope, non-goals, constraints,
decisions, acceptance, verification, risks, GSD trigger when relevant) that
links the source as evidence. Execution ledgers stay out of ADRs and human
docs. Changing a repo's lifecycle layout is its own scoped migration.

## Context Files

`CONTEXT.md` and `CONTEXT-MAP.md` (maintained through `grill-with-docs`) record
domain language and decision boundaries; they are not PRDs, checklists, or
phase ledgers. Check them when terms, invariants, or contract boundaries
matter, using `CONTEXT-MAP.md` to pick the right file. For plan-backed
implementation, the plan and the context entries it references are part of the
execution context and are read before editing code. Vocabulary decisions go to
context; implementation steps go to the plan or GSD. Context files stay when
plans exist; prune only obsolete entries after checking references.

## Project Status Integration

Roles, capsule selection, and lifecycle follow
[durable run](../../_shared/references/durable-run.md).

At start, find whether the repo names `STATUS.md` or an equivalent project
status surface and read it when relevant. If none exists, record project status as `not present/not adopted`
and continue; status is optional.

A project-status delta is material only for supported commands or runtime
surfaces, public contracts or proof boundaries, or project-wide focus,
blockers, verification state, or next action. Task slices, worker results,
task-local blockers, and ordinary completion evidence stay in the task capsule.

At checkpoint and closeout, the task control plane classifies the delta as
`none` or `material`. Only the explicit project integrator applies a material
delta; a task control plane without that role reports it in the handoff. When
writer ownership is ambiguous, the status edit waits, because merging
concurrent interpretations corrupts shared status. Status stays short and
project-level rather than duplicating plans, capsules, or notes.

When the project integrator edits `STATUS.md` or an equivalent first-read doc,
it treats 120 lines as a soft budget and 200 lines as a hard closeout limit.
Between 121 and 200 lines it trims stale history within the owned edit. Above
200 lines it must compact the document before commit and closeout, keeping current state, commands,
focus, blockers, next maintenance, and links, and moving detail to an existing
plan, retrospective, or human doc.

This budget is not permission for a worker or unassigned task control plane to
rewrite shared status. A target repo may mirror the limit in a hook or CI
check, but Flow works without one: it does not invoke an AI from a commit hook
or mutate target repos during install. Without a material delta or integrator
role, an oversized status doc is reported as a parked cleanup signal.

## Plan Freshness At Closeout

A plan that still says `Proposed`, `Active`, or "next slice" after its work
shipped misroutes future agents, so closeout refreshes what changed: ledger
fields, the dashboard row, status (`Done`, `Partially implemented`,
`Superseded`, or `Active` with remaining gates), last reviewed, the current
implementation contract, shipped evidence (commits, commands, reports), and
remaining or parked work with its unpark trigger. Prefer refreshing existing
fields over appending history; keep an old decision visible only when a link
cannot carry it.

A plan counts as implemented when its acceptance gates are verified. Pending
local or hardware evidence, or remaining in-scope work, means `Partially
implemented` or `Active` with the blocker named. A superseding plan is linked
from the old one.

## Provenance Honesty

Name where decisions and artifacts came from. Output from a workflow that
actually ran is cited as that workflow's; output produced inline with similar
reasoning is labeled `intuitive-flow` output.

- Flow may write `docs/plans/<slug>.md` pre-plans inline. Discussion skills such
  as `grill-with-docs` shape decisions; the current agent writes the plan.
- The opt-in plan prose gate's result is checkpoint evidence reported outside
  the plan; scores, candidate rewrites, and trial logs stay out of the plan.
- ADRs are written only by an ADR-capable skill or on request.
- `.planning/*` is GSD-owned and changes only through GSD commands
  (`gsd-ingest-docs`, `gsd-plan-phase`), so GSD's own state stays consistent.
- One-off worker prompts are transient; reusable agent rules go to
  `docs/agents/<runbook>.md`, and a prompt summary enters the capsule only when
  it affects resume.
- `~/.gstack` artifacts, review logs, and restore points are evidence.

## Phase Granularity

A GSD phase is one coherent delivery unit: a user-visible capability, an
acceptance artifact, a risk gate, a bounded refactor outcome, or a local-dev
validation gate. Blockers, diagnostics, proof retries, report or checker
tweaks, and individual commits are tasks or checklist rows inside the current
phase. Before creating more than three phases from one prompt, propose a
smaller grouping: the phase set, what stays as tasks, what is parked, and the
evidence that closes each phase.
