---
name: intuitive-shape
description: Shape unsettled product ideas into bounded bets before planning; excludes settled fixes and approved execution.
---

# Intuitive Shape

Decide whether work deserves to exist before making it executable. Fixed
appetite constrains the solution; it is not an estimate produced after scope is
chosen.

## Boundary

Own problem framing, appetite, rough solution elements, risk, explicit cuts,
comparative bet selection, and the terminal decision. Shape ends at that
decision: implementation, task breakdowns, and backlogs belong downstream, and
many ideas should end as `PASS` rather than become projects.

Route accepted work to the repository's canonical plan or preflight surface,
reusing it when one already exists so there is one source of truth.

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
6. When several candidates compete for capacity, compare them against each
   other; judged in isolation, every candidate tends to look worthy.
7. Return exactly one decision:
   - `BET`: bounded, valuable, sufficiently understood, and worth doing now.
   - `RESEARCH`: a cheap, time-boxed probe can resolve a decision-critical fact.
   - `RESHAPE`: the problem matters, but the current solution does not fit the appetite.
   - `PASS`: not worth capacity now; end without creating a permanent backlog item.

Read [shaped bet contract](references/shaped-bet-contract.md) before producing
the final contract.

## Decision Discipline

These are the ways shaping usually goes wrong:

- Demand comes from evidence about the problem, not from stakeholder enthusiasm
  or how easy the build looks.
- Appetite comes before scope; an estimate of an already expanded feature list
  is not an appetite.
- `RESEARCH` is for a decision-critical unknown; ordinary implementation
  uncertainty belongs to the builder.
- `PASS` is a real no for now, worded so it does not read as deferred approval.
- The core slice holds only what the core outcome needs; nice-to-haves go on
  the cut list.
- Appetite-driven delivery holds only when appetite, no-gos, cut order, and the
  circuit breaker are carried into the downstream plan or preflight.

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

Omit `Candidates considered` and `Evidence needed` when there is nothing to
report. For `PASS`, the fields after `Decision rationale` can be dropped.

For `RESEARCH`, name the smallest probe, its time box, and the result that would
change the decision. For `BET`, ensure downstream owners can preserve the
appetite and cuts without copying a second artifact. For `PASS`, stop.
