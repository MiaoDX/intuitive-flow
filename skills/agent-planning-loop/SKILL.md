---
name: agent-planning-loop
description: Review unsettled plans with independent scouts when the user requests multi-agent planning or alignment.
disable-model-invocation: true
---

# Agent Planning Loop

Run a bounded planning debate when requested. Return one judged recommendation;
do not implement, approve the plan, or let scouts ask the user questions.
Preserve the full intended scope of a supplied plan unless the user selects a
subset or a material decision blocks honest full-plan execution.

Set a brief charter: goal, non-goals, context, permitted worker actions, and stop
condition. Use [scouts](references/scouts.md) when preparing worker prompts and
judging their evidence. Main-session judgment owns the recommendation.

Default to at most two rounds: discovery/challenge, then a narrowed follow-up only
if it can change the recommendation. Stop sooner when a plan has clear acceptance
and proof, the remaining items are implementation defaults, or a user decision
blocks progress. A deeper autonomous loop requires the user's request.

## Output

Return a review packet, not a transcript.

Include: planning loop status, what ran, rejected/parked items, one recommended
plan with scope/non-goals/acceptance/verification/risk, alternatives only when
material, user decisions, `Plan artifact:`, `Recommended next action:`, and
`Shortcut:`.

For plan-file loops, the `Recommended next action` should normally execute or
preflight the whole plan through the appropriate route. It may name the first
phase as the starting point, but should not make that phase the whole approved
scope unless the user asked for that narrowing or a stop gate blocks the rest.

If no material plan remains, say so directly and explain what evidence caused
the stop. Do not fill the packet with weak alternatives. Still include
`Recommended next action` and `Shortcut`; use `park/none` when there is genuinely
no useful next step.

## Approval Handling

If the user approves the review packet, do not rerun the planning loop unless
their approval changes scope. Route to the single `Recommended next action`.
Treat short replies such as `LGTM`, `approve`, `sounds good`, or `do it` as
approval for that action and preserve the packet's plan artifact, scope,
verification, user decisions, parked items, and stop condition.

If the user pushes back on part of the recommendation, treat that as new charter
input. Rerun only the affected scout stage, not the whole loop.
