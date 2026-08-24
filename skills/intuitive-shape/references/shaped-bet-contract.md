# Shaped Bet Contract

Use this contract as decision information, not as a new project-state file.
Merge it into the target repository's canonical plan or preflight artifact.

## Required Semantics

- `Problem` describes a concrete costly situation, not a feature request.
- `Appetite` is a maximum justified investment selected before solution scope.
- `Core outcome` is observable without enumerating implementation tasks.
- `Core slice` crosses the full user-visible path with optional breadth removed.
- `Rabbit holes` name risks likely to consume the appetite and their patch or cut.
- `No-gos` prevent plausible scope from entering the current bet.
- `Cut order` says what disappears first while the core outcome remains intact.
- `Circuit breaker` says when the work stops, returns to shaping, or becomes a new bet.
- `Decision` is terminal for this shaping pass.

## Handoff Preservation

An accepted downstream plan or preflight must preserve, in its own vocabulary:

| Shaped field | Downstream invariant |
| --- | --- |
| Appetite | Time/effort ceiling and expansion trigger |
| Core outcome | Acceptance or success signal |
| Core slice | Smallest product-run proof |
| Rabbit holes | Risks, probes, or stop gates |
| No-gos | Non-goals and no-touch boundary |
| Cut order | Scope-reduction policy during execution |
| Circuit breaker | Hard stop or reshape condition |

If those invariants disappear during handoff, do not call the workflow
appetite-driven. Repair the canonical downstream artifact before implementation.

## Comparative Betting

When capacity forces a choice, compare candidates on the same fields:

- evidence and severity of the problem;
- fit between appetite and core slice;
- unresolved risk relative to appetite;
- strategic timing and opportunity cost;
- availability of a cheaper research bet.

Choose the best current bet, not every candidate above an abstract quality bar.
