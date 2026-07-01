# Source Of Truth And Provenance

Use this reference whenever a route creates, promotes, or consumes planning
artifacts.

## Stage Source Of Truth

Keep one authoritative artifact family per stage:

| Stage | Source of truth |
| --- | --- |
| Before committed execution | `docs/plans/<slug>.md` or GitHub issues |
| During execution | `.planning/STATE.md` and `.planning/phases/*` |
| After shipping | verification reports, summaries, retrospectives, and release/closeout notes |

When handing work from one stage to the next, update the canonical artifact in
place. Treat generated review logs, restore files, chat history, and temporary
notes as evidence only.

`docs/plans/` is a stable flat plan-contract surface: one plan, one
`docs/plans/<slug>.md` file. Do not create lifecycle subdirectories under
`docs/plans/` for active, proposed, or archived work. Lifecycle belongs in the
plan's `Plan Ledger`, `Status`, `Last reviewed`, shipped evidence, remaining
gates, and superseded-by links. Current execution progress belongs in
`docs/status/active/<task-slug>.md`; GSD runtime state belongs only in
GSD-owned `.planning/*` artifacts.

## Plan Ledger And Dashboard

When creating or materially updating `docs/plans/<slug>.md`, keep a compact
`## Plan Ledger` near the top of the file, before long rationale. The ledger is
the hot-resume selector for shared-worktree projects where multiple plan-backed
sessions may be active at once; it should answer "what session am I in?" before
an agent reads the full plan.

Use this shape, preserving equivalent local wording when a repo already has a
ledger convention:

```markdown
## Plan Ledger

- Plan status: ACTIVE | PARKED | PROPOSED | DONE | SUPERSEDED
- Session scope: short-session-name
- Parent plan: path or none
- Child plans: paths or none
- Last updated: YYYY-MM-DD
- Current slice: one or two lines
- Next action: one concrete next step
- Blocked on: blocker or none
- Do not touch from this session: unrelated plans/files
```

`docs/plans/README.md`, when present or useful to create, is the plan dashboard.
It should list the current plan set and enough session scope to choose the right
plan without opening every file. Update the dashboard row when creating a plan
or changing a plan's status, session scope, parent/child relation, current
slice, next action, or blocker. Do not turn the dashboard into a transcript; it
is an index.

Plan maintenance is replacement-first. When current truth changes, edit the
ledger, dashboard row, and current contract in place; remove or compress stale
next actions, superseded gates, rejected scene/profile details, completed
worker slices, and old blocker prose. Prefer one current objective, one next
gate, one blocker summary, and links to evidence notes over dated append blocks.
If a plan is drifting away from its main goal or forcing agents to read long
history before the next action is clear, compact it before continuing.

Before editing a plan-backed repo with multiple active plans, identify the
active plan/session scope from the user prompt, `docs/plans/README.md`, the
plan ledger, or the active capsule. Lock the run to that scope. Update only that
plan's ledger, its related active capsule/result notes, and files in its
accepted scope unless the user explicitly switches sessions.

Cross-plan artifacts may be linked as evidence or dependencies, but do not
opportunistically reclassify another plan, tick its checklist, or rewrite its
ledger/dashboard row from inside the current session. If another plan appears
stale, mention it as a parked observation or ask for a session switch.

## Plan-Like Intake

If the user points at exactly one markdown file that looks like a plan, accept:

- `docs/plans/*.md`
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

If a legacy repo already has plan lifecycle subdirectories, normalize new and
touched plans back to the flat `docs/plans/<slug>.md` surface unless the user
explicitly protects the old layout for this slice.

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

For parallel standalone terminal work or durable resume state, use
`docs/status/active/<task-slug>.md` instead of editing `STATUS.md` for routine
progress. If `docs/status/active/` does not exist, create it. The active file is
a compact capsule for current execution state; `STATUS.md` remains the
project-level human status surface.

When maintaining active capsules, include a compact `Capsule status` field such
as `ACTIVE`, `PARKED`, `BLOCKED`, `DONE`, `SUPERSEDED`, or `ABSORBED`. A capsule
is not proof that every referenced plan is current; use the plan dashboard and
the source plan's ledger to choose the active session.

Active capsules are hot-resume indexes, not journals. Keep them short enough
for a low-context resume. Replace old "current slice" and "next action" text
when the run moves; do not append another dated status section unless the old
section is archived into a result note or removed. If repeated updates make the
capsule long, summarize completed batches, keep only the latest blocker
fingerprint and proof links, and delete superseded execution narration.

Do not create parallel resume files such as `.continue-here.md` or
`.planning/HANDOFF.json`. `.planning/*` is GSD-owned state, and ad hoc resume
notes should be folded into the active capsule or the canonical plan.

## Plan Freshness At Closeout

When a flow implements work from `docs/plans/<slug>.md`, update that source plan
before final closeout if its status, current contract, or remaining-work list no
longer matches HEAD. A plan that still says `Proposed`, `Active`, "to
implement", or "next slice" after the accepted work has shipped is stale
canonical state and will misroute future agents.

Refresh only the planning truth that changed:

- `Plan Ledger`: `Plan status`, `Last updated`, `Current slice`, `Next action`,
  `Blocked on`, `Parent plan`, `Child plans`, and `Do not touch from this
  session` when those changed.
- `docs/plans/README.md`: the dashboard row for that plan when status/session
  or next action changed.
- `Status`: `Done`, `Partially implemented`, `Superseded`, or still `Active`
  with explicit remaining gates, if the plan keeps a separate status section.
- `Last reviewed`: the closeout date.
- `Current implementation contract`: current command/API/profile/tool shape if
  it changed.
- `Shipped evidence` or equivalent: commit ids, verification commands, report
  artifacts, or phase/retrospective links.
- `Remaining work` / `Parked follow-ups`: items not implemented, with why they
  remain out of scope or what gate would unpark them.

Before adding a new closeout paragraph, decide whether it should replace stale
state. The default closeout edit is a compact refresh of existing fields plus
evidence links. Add append-only history only when the old decision must remain
visible for future agents and cannot be represented by a link to a result note,
commit, ADR, or archive.

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
  `.planning/` inline or by writing `.planning/HANDOFF.json`; use
  `gsd-ingest-docs` and `gsd-plan-phase`.
- One-off worker prompts and delegation packets are transient execution
  material. Do not create `docs/agents/prompts/` by default; promote reusable
  agent rules to `docs/agents/<runbook>.md` and keep one-run prompt summaries in
  the active capsule only when they affect resume.
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
