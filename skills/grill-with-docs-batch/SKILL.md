---
name: grill-with-docs-batch
description: Grouped grilling session that wraps grill-with-docs semantics while discussing related questions in batches, with explicit convergence checks so it stops when docs already contain enough decision quality. Use when the user wants to stress-test a plan against docs and domain language faster than one-question-at-a-time grilling, especially when asking whether remaining questions exist.
---

# Grill With Docs Batch

Challenge a plan against the repository's domain model and documentation like
`grill-with-docs`, but move in small coherent batches instead of one question at
a time.

## First Decide Whether To Stop

Before asking any batch, run a saturation audit:

- Read the target plan/ADR/spec and the domain glossary or context file it
  depends on.
- Check recent git history for the same target docs when available, but use it
  only as supporting evidence. Commit count is not a stop condition by itself;
  it helps find decisions that were already made and areas that may be getting
  re-litigated.
- Separate durable decision questions from implementation defaults. Do not ask
  the user to discuss things the implementation can decide locally without
  changing public contracts, private-data boundaries, safety policy, cost/model
  infrastructure, or irreversible file moves.
- If an ADR is accepted, a plan names what changes, what is out of scope, the
  important boundaries, the acceptance gates, and the next execution step, and
  local docs/code do not contradict it, answer that no more discussion is needed.
- Classify the documentation target before proposing updates: plans and ADRs
  answer different questions, and some tasks legitimately need both.

When the user asks whether remaining questions exist, answer the yes/no first.
Only ask a batch if at least one unresolved question would materially change the
plan, contract, public/private boundary, or acceptance gate.

## Plan vs ADR Routing

Do not treat `docs/plans/*` and `docs/adr/*` as interchangeable planning
surfaces.

Use a plan file when the question is:

- what will change;
- what is out of scope;
- what order or phases should execute;
- which files, tests, commands, gates, or artifacts define done;
- which open questions remain before implementation.

Use an ADR when the question is:

- which durable decision future agents should not relitigate;
- which public API, MCP/tool contract, command surface, private-data boundary,
  safety policy, or architecture layer is intentionally chosen;
- which alternatives were rejected and what consequences maintainers accept.

Some tasks need both. In that case, keep the ADR short and durable, then let the
plan reference the ADR while owning execution details. Do not create an ADR for
local implementation defaults, a checklist, progress notes, or a decision that
the current plan can reverse cheaply. Do not put phase checklists, verification
logs, or task sequencing into an ADR.

Before asking "should this be an ADR?", first state whether the current issue is
contract-shaped or execution-shaped. If it is execution-shaped, default to the
plan file. If it is contract-shaped but the exact public shape is not selected
yet, default to recording the current assumption in the plan and defer the ADR
until the public contract is chosen.

## Decision-Impact Test

Before asking a question, state why its answer matters. A question is worth
asking only when a concrete answer could change at least one of:

- the public API, MCP/tool contract, file layout, or command surface;
- private-data, safety, security, credential, cost, or external-infrastructure
  boundaries;
- acceptance criteria, verification gates, rollout gates, or hard blockers;
- phase ordering, ownership, or whether a feature belongs in the current slice;
- glossary/ADR language whose meaning affects future implementation choices.

If the answer would only choose a local implementation default, test detail,
wording polish, or "nice to record" preference, do not ask. Pick the conservative
default, or patch the plan directly if the user asked to record defaults.

## Core Rule

Keep the quality bar of `grill-with-docs`:

- Challenge vague or overloaded terms against `CONTEXT.md` or `CONTEXT-MAP.md`.
- Explore code and docs instead of asking questions that local context can answer.
- Use concrete scenarios and edge cases to force precise boundaries.
- Update `CONTEXT.md` inline as soon as glossary terms are resolved.
- Offer ADRs only when a decision is hard to reverse, surprising without
  context, and the result of a real trade-off.
- Stop once the remaining items are implementation defaults, test details, or
  local wording polish rather than unresolved product/domain decisions.

The behavioral changes are pacing and convergence: ask grouped questions when
the questions belong to the same decision layer, and stop when the remaining
items no longer need user decision.

## Stop Conditions

Stop grilling and say so when any of these are true:

- The target docs let an implementer answer: what changes, what does not change,
  what boundary must be protected, how it will be verified, and what the next
  execution step is.
- Remaining candidate questions fail the Decision-Impact Test.
- Git history or prior discussion shows repeated refinement of the same area and
  the new pass would not change what gets built, verified, or protected.
- The question would produce another planning-document edit but would not change
  what gets built, verified, or protected.
- The user shows process-fatigue signals such as "we have done this multiple
  times", "is this just not stopping", or "can we move on".

Default response at a stop condition:

```text
No more discussion is needed before implementation.

What is already decided:
- <durable decision>
- <boundary/gate>

Remaining items are implementation defaults:
- <default the implementer can choose>

Next step: <execute / convert to tasks / patch the plan narrowly>
```

Do not convert implementation defaults into another batch. If the user wants the
defaults recorded, patch the plan directly with concise defaults instead of
asking more questions.

## Batch Shape

Each batch should contain 3-6 tightly related questions. Use fewer when the
decision is risky or highly dependent.

```text
Batch N: <short theme>

Assumptions from docs/code:
- <what was verified locally>

Questions:
1. <decision question>
   Recommended answer: <clear default and why>
2. <decision question>
   Recommended answer: <clear default and why>

If accepted, I will update:
- CONTEXT.md: <terms/relationships>
- Plan: <execution details / gates / open questions, or "none">
- ADR: <only if warranted, otherwise "none">
```

Wait for the user's response before applying docs or moving to the next batch.
Accept shorthand answers such as "all agree", "1 yes, 2 no because...", or
"change 3 to...".

Do not impose a fixed batch limit on a first-pass grill of an unclear plan. After
each batch, re-run the saturation audit and either stop or explain which
Decision-Impact Test item justifies another batch. For a target that is already
accepted, repeatedly refined, or close to execution, default to zero or one batch
unless the user explicitly asks to keep exploring.

## When To Fall Back To One Question

Ask one question at a time when:

- A term conflicts with the current glossary and affects every later question.
- The user's answer could materially change the batch structure.
- A decision touches public contracts, private data boundaries, safety policy,
  security, irreversible file moves, or external paid/model infrastructure.
- Local docs/code contradict the user's premise.

## Documentation Discipline

After each accepted batch:

1. Apply only the resolved `CONTEXT.md` glossary/relationship updates.
2. Keep `CONTEXT.md` free of implementation details, plans, and progress notes.
3. If a plan update is warranted, keep it focused on scope, execution order,
   acceptance gates, verification, and open implementation questions.
4. If an ADR is warranted, create or update it separately with clear context,
   decision, alternatives, and consequences. Link it from the plan when both
   surfaces are needed.
5. Report exactly what changed, then run the saturation audit before asking any
   next batch.

## Language

Mirror the user's language for the discussion. Keep questions direct and include
your recommended answer for each question.
