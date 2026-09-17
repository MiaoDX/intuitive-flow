---
name: intuitive-tests
description: Audit or improve test-suite structure and signal when the user asks about redundancy, pruning, layout, fixtures, or parameterization.
---

# Intuitive Tests

Improve test-suite signal and maintainability. Keep proof of observable behavior,
real failure modes, and supported contracts; consolidate duplicates and remove
assertions that merely restate implementation shape. Do not delete the last
meaningful proof of a behavior. Runtime discovery and packaging checks can be
valuable contracts even when they look structural.

For broad or ambiguous cleanup, audit then propose a decision-complete slice.
For a precise implementation request, execute that slice and park unrelated ideas.
Keep existing repo test conventions; pytest examples are not a required taxonomy.

## Modes

| Mode | Use when | Output | Redirect when |
| --- | --- | --- | --- |
| Audit / propose | Cleanup target is unclear | Evidence, candidates, bounded recommendation and proof plan | A slice is already approved |
| Prune / consolidate | Tests duplicate proof or bind internals | Smaller suite with behavior coverage preserved | No redundant proof exists |
| Marker / layout | Suite selection or paths need organization | Updated runners, consumers and collection proof | The issue is test value |
| Fixture / parameterize | Repeated setup or cases obscure intent | Shared setup or cases with readable diagnostics | Reuse is speculative |

Read [value and pruning](references/value-and-pruning.md) for test admission or
deletion decisions; read [suite structure](references/suite-structure.md) only for
markers, moves, fixtures, or parameterization. An audit may recommend a route
without loading every implementation procedure.

Verify the changed behavior and affected runner/collection paths. Derive any
external-service, hardware, or credential limits from current user/repo policy.
Report kept/merged/deleted/reclassified tests, remaining proof, affected commands,
and skipped checks with their actual reason.
