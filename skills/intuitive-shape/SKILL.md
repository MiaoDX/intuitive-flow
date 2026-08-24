---
name: intuitive-shape
description: |
  Shape a raw product or project idea into a bounded decision before planning
  or implementation. Use when deciding whether an idea deserves a bet, setting
  an appetite, comparing candidate bets under finite capacity, cutting scope,
  exposing rabbit holes and no-gos, or choosing BET, RESEARCH, RESHAPE, or PASS.
  This skill stops before execution and hands accepted bets to the repository's
  existing planning or preflight route. Do not use for a clearly bounded tiny
  fix, active incident diagnosis, ordinary bug repair, or already approved
  execution unless the user asks to revisit the bet or scope.
---

# Intuitive Shape

Decide whether work deserves to exist before making it executable. Fixed
appetite constrains the solution; it is not an estimate produced after scope is
chosen.

## Boundary

Own problem framing, appetite, rough solution elements, risk, explicit cuts,
comparative bet selection, and the terminal decision. Do not implement, produce
a task breakdown, create a backlog, or silently turn every idea into a project.

Route accepted work to the repository's canonical plan or preflight surface.
Do not create a parallel source of truth when one already exists.

Stay out of tasks whose product decision is already settled. A small concrete
fix, root-cause investigation, incident containment, or approved execution
belongs to its normal diagnostic or execution route. Shape only when the user
is deciding whether the work should exist, how much it deserves, which candidate
wins, or what scope must be cut before commitment.

## Shape The Decision

1. Separate the observed problem from the suggested solution. Identify who has
   the problem, the costly status quo, and evidence that it matters now.
2. Set an appetite before expanding the solution. Express the maximum justified
   time or effort and why spending more would be a bad bet.
3. Sketch only the essential solution elements at rough fidelity. Preserve room
   for the builder to discover implementation details.
4. Name rabbit holes, no-gos, and unresolved assumptions. Patch or cut risks
   that can consume the appetite.
5. Define the smallest end-to-end core slice and an ordered cut list. A cut must
   reduce work while preserving the core outcome.
6. When several candidates compete for capacity, compare them directly. Do not
   evaluate each in isolation and declare all of them worthy.
7. Return exactly one decision:
   - `BET`: bounded, valuable, sufficiently understood, and worth doing now.
   - `RESEARCH`: a cheap, time-boxed probe can resolve a decision-critical fact.
   - `RESHAPE`: the problem matters, but the current solution does not fit the appetite.
   - `PASS`: not worth capacity now; end without creating a permanent backlog item.

Read `references/shaped-bet-contract.md` before producing the final contract.

## Decision Discipline

- Do not infer demand from stakeholder enthusiasm or implementation ease.
- Do not use estimates to justify an already expanded feature list.
- Do not label ordinary implementation uncertainty as a research bet.
- Do not make `PASS` sound like deferred approval.
- Do not preserve nice-to-haves inside the core slice.
- Do not claim appetite-driven delivery unless appetite, no-gos, cut order, and
  the circuit breaker are carried into the downstream plan or preflight.

## Output

Keep the result compact and decision-oriented:

```text
Shaping status: <READY | BLOCKED_NEEDS_DECISION>
Problem: <user, costly status quo, evidence>
Appetite: <maximum justified investment and rationale>
Core outcome: <observable result>
Solution outline: <rough elements, not tasks>
Core slice: <smallest end-to-end version>
Rabbit holes: <material risks and patches>
No-gos: <explicit exclusions>
Cut order: <first-to-last cuts if pressure rises>
Circuit breaker: <condition that stops or reshapes the bet>
Candidates considered: <comparative alternatives or none>
Decision: <BET | RESEARCH | RESHAPE | PASS>
Decision rationale: <why this decision and why now/not now>
Evidence needed: <decision-critical proof or none>
Handoff: <canonical plan/preflight route | terminal PASS>
```

For `RESEARCH`, name the smallest probe, its time box, and the result that would
change the decision. For `BET`, ensure downstream owners can preserve the
appetite and cuts without copying a second artifact. For `PASS`, stop.
