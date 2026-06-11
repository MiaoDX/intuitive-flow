# Source Of Truth And Provenance

Use this reference whenever a route creates, promotes, or consumes planning
artifacts.

## Stage Source Of Truth

Keep one authoritative artifact family per stage:

| Stage | Source of truth |
| --- | --- |
| Before committed execution | `docs/plans/*.md` or GitHub issues |
| During execution | `.planning/STATE.md` and `.planning/phases/*` |
| After shipping | verification reports, summaries, retrospectives, and release/closeout notes |

When handing work from one stage to the next, update the canonical artifact in
place. Treat generated review logs, restore files, chat history, and temporary
notes as evidence only.

## Plan-Like Intake

If the user points at exactly one markdown file that looks like a plan, accept:

- `docs/plans/**/*.md`
- `docs/adr/**/*.md`
- `docs/adrs/**/*.md`
- `docs/human/**/*.md`

Use a file directly only when it already lives under `docs/plans/`. For ADR or
human docs, extract the execution-ready material into `docs/plans/<slug>.md`:
goal, scope, non-goals, constraints, decisions, acceptance criteria,
verification expectations, risks, and GSD handoff trigger. Link the original as
source evidence. Do not append `autoplan` reports or execution ledgers to ADR or
human-facing docs unless the user explicitly asked to update that document.

If the supplied file is mostly reference material, create a draft
`docs/plans/<slug>.md` with clear unknowns and stop before review unless the run
contract explicitly says to continue.

## Context Files

Some repos maintain `CONTEXT.md` or `CONTEXT-MAP.md` through
`grill-with-docs`. Treat context files as domain-language and
decision-boundary evidence, not as PRDs, scratch pads, implementation
checklists, or phase ledgers.

Check context at the start of fuzzy idea shaping, plan shaping,
architecture/refactor routing, or implementation when terms, invariants, or
long-lived contract boundaries matter. If `CONTEXT-MAP.md` exists, use it to
select the relevant context file instead of assuming root `CONTEXT.md`.

For plan-backed implementation, read the source `docs/plans/<slug>.md` and any
context files it references before editing code. If the plan names domain terms,
public/private boundaries, acceptance criteria, safety rules, command surfaces,
or MCP/tool contracts, the relevant `CONTEXT.md` entry is part of the execution
context package, not optional background reading.

When discussion resolves vocabulary or durable boundaries, update context
through `grill-with-docs` semantics: keep domain language in context, keep
implementation steps in `docs/plans` or GSD artifacts, and cite context from the
plan when it informs acceptance criteria.

Do not delete or relocate `CONTEXT.md` merely because `docs/plans` or
`.planning` artifacts exist. Remove only obsolete entries after checking
references and preserving the active domain language somewhere equivalent.

## STATUS.md Cadence

For non-trivial or durable `intuitive-flow` runs, check `STATUS.md` at both
ends.

At start, read `STATUS.md` before creating the first workflow artifact or
launching downstream skills. Update it if the flow changes current focus, next
action, active phase, known blocker, or verification expectation. Keep it short;
do not duplicate the plan, GSD ledger, or execution notes.

At closeout, read `STATUS.md` again and update it when focus, status, next
action, blocker, verification state, or handoff expectation changed. If no
update is needed, say it was checked and left unchanged.

For parallel standalone terminal work, use
`docs/status/active/<task-slug>.md` instead of editing `STATUS.md` for routine
progress.

## Plan Freshness At Closeout

When a flow implements work from `docs/plans/<slug>.md`, update that source plan
before final closeout if its status, current contract, or remaining-work list no
longer matches HEAD. A plan that still says `Proposed`, `Active`, "to
implement", or "next slice" after the accepted work has shipped is stale
canonical state and will misroute future agents.

Refresh only the planning truth that changed:

- `Status`: `Implemented`, `Partially implemented`, `Superseded`, or still
  `Active` with explicit remaining gates.
- `Last reviewed`: the closeout date.
- `Current implementation contract`: current command/API/profile/tool shape if
  it changed.
- `Shipped evidence` or equivalent: commit ids, verification commands, report
  artifacts, or phase/retrospective links.
- `Remaining work` / `Parked follow-ups`: items not implemented, with why they
  remain out of scope or what gate would unpark them.

Do not mark a plan implemented merely because code changed. If acceptance gates
were not verified, local/hardware evidence is still pending, or in-scope work
remains required, use `Partially implemented` or `Active` and state the blocker.
If a newer plan supersedes the old one, link the newer plan instead of rewriting
history into the old file.

## Provenance Honesty

Name where decisions and artifacts came from. If another workflow actually ran,
say so and use its output as evidence. If you produced an output inline with
similar reasoning, label it as `intuitive-flow` output instead of borrowing the
other workflow's name.

Artifact rules:

- `docs/plans/<slug>.md` pre-plans may be produced inline by this skill.
- Discussion skills such as `grill-with-docs` shape decisions through
  questions; the current agent still writes the plan unless a writing skill is
  invoked.
- ADRs are not default outputs of this skill. Create/update ADRs only when an
  ADR-capable skill is explicitly used or the user asks.
- `.planning/*` files are GSD-owned. Do not approximate GSD by editing
  `.planning/` inline; use `gsd-ingest-docs` and `gsd-plan-phase`.
- `~/.gstack` artifacts, review logs, and restore points are evidence only.

## Phase Granularity

A GSD phase should be one coherent delivery unit: one user-visible capability,
acceptance artifact, risk gate, bounded refactor outcome, or local-dev
validation gate.

Do not create a new phase for every blocker, diagnostic improvement, proof
retry, report tweak, checker tweak, ADR-worthy detail, or commit. Use tasks,
checklist items, notes, or verification rows inside the current phase.

Before creating more than three phases from one user prompt, stop and propose a
smaller grouping. Name the smallest sensible phase set, what stays as tasks,
what is parked, and what evidence closes each phase.
