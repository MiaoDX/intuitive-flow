# Plan Intake And Autoplan

Use this reference for fuzzy ideas, plan-like markdown intake, and any request
to implement from a plan.

## Fuzzy Idea

Use when the user is still deciding what to build, why it matters, or what the
scope should be.

Choose the idea-shaping route before the first question unless the user already
made the mode clear:

```text
Which route should we use?

A. Direct route (preferred) - plain, more detailed, and user-led. I ask the
   important questions directly and wait for your answers.
B. Auto-guided route (experimental) - I auto-accept obvious defaults, save those
   decisions into the plan, and ask only for scope, premise, or hard-to-reason
   choices.
```

Mode rules:

- Direct route when the user asks for direct/manual shaping, asks to discuss the
  idea plainly, or names `$grill-with-docs` style questioning.
- `$intuitive-planning-loop` when the user asks agents to align first, run
  reduce-entropy plus grill-batch critique, compare plans, or return one judged
  review packet.
- Auto-guided route when the user asks for auto mode, says to make the
  decisions, or asks to move fast.
- Direct route when no preference is stated.
- Skip the prompt when a draft plan already exists and the next step is review.

Default paths:

```text
direct: inline intuitive-flow shaping -> docs/plans/<slug>.md
planning loop: intuitive-planning-loop -> review packet -> docs/plans/<slug>.md after approval
auto-guided: intuitive-flow auto-guided shaping -> docs/plans/<slug>.md
```

If the question is product direction, wedge, audience, demand, or "is this worth
building?", keep it in direct shaping unless an optional product-discovery skill
is explicitly installed and invoked.

Stop after the plan doc unless the user explicitly asks to continue.

## Auto-Guided Shaping

Use auto-guided shaping only before `docs/plans/<slug>.md` exists and only when
the user chose or clearly requested it. It may borrow the question style of
`grill-with-docs`, but label the work as inline `intuitive-flow` unless that
workflow actually ran.

Decision classes:

| Class | Action |
| --- | --- |
| Mechanical | Auto-decide from repo, docs, conventions, or user's own words |
| Assumption | Auto-decide when low-risk, reversible, and scope-preserving; mark as assumption |
| Taste | Choose the strongest recommendation and surface it at plan checkpoint |
| User-owned | Stop and ask |

User-owned choices include target user, demand premise, painful status quo,
narrowest wedge, goal/non-goal boundary, public contract, security/privacy
posture, external service, API key, paid infrastructure, phase split, or any
override of stated intent.

Record auto-guided decisions in the generated plan:

```markdown
## Idea Shaping Decisions

| # | Question | Classification | Decision | Rationale | Revisit if |
|---|----------|----------------|----------|-----------|------------|
```

At the plan checkpoint, show only open user-owned questions, taste decisions
worth reviewing, assumptions that could change scope, and skipped unknowns that
affect execution or validation.

## Single Plan-File Intake

Follow `source-of-truth.md` for accepted roots and refactoring rules. The
canonical review/input artifact must be `docs/plans/<slug>.md`.

Pre-plan contents:

- problem / goal
- shaping mode
- decisions already made
- non-goals
- smallest demo and fuller demo
- success criteria and acceptance criteria
- proposed vertical slices
- verification expectations
- GSD handoff trigger
- source evidence links

Use `templates/pre-plan.md` when drafting a new plan.

## Autoplan Precheck Before Implementation

When the user asks to implement a specific plan, says "LGTM", says "impl" while
pointing at a plan, or approves a plan-backed run, first resolve the canonical
`docs/plans/<slug>.md` path. Then check whether `autoplan` already ran and its
accepted decisions were reconciled into that file.

Treat as `autoplan` evidence:

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

If evidence is missing, classify as `Draft Plan Exists` and run:

```text
gstack-autoplan docs/plans/<slug>.md
```

For whole-flow, implementation, or long-running review runs, prefer launching
`autoplan` through `skill-runner` so the main session can supervise and inspect
artifacts before reconciliation.

Do not say `autoplan` was bypassed because the user approved implementation.
Say `autoplan` is selected because pipeline review evidence is missing.

## Autoplan Reconciliation

`gstack-autoplan` is a review pipeline, not an implementation tool. It may
refine scope, risks, tests, DX, and sequencing, but must not start coding.

When review is approved or classified as a soft continuation:

1. Update the canonical plan in place with accepted decisions.
2. Keep or link external `~/.gstack` artifacts only as evidence.
3. Verify the plan body contains accepted acceptance criteria and GSD handoff.
4. Surface scope changes before execution.

If the only repo change after review is a restore comment or appended review
report, do not hand off yet. First edit the plan body so the next stage ingests
the approved plan, not the review artifact.

Scope-change hint before implementation:

```text
Autoplan scope changes: <none | accepted changes | hard-stop changes>
Accepted into plan: <short bullets or "none">
Parked/deferred from autoplan: <short bullets or "none">
Hard-stop decisions still needing user input: <short bullets or "none">
```

Treat new/disputed product scope, public contracts, security/privacy posture,
paid services, data model changes, phase ownership changes, or incompatible
requirements as hard stops. Treat clarified tests, implementation sequencing,
DX cleanup, and risk notes that preserve original intent as accepted updates
once reconciled into the plan.
