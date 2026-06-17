---
refactor_scope: reduce-entropy-test-ownership
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-06-17
---

# Refactor Scope: Reduce Entropy Test Ownership

## Status

DONE

## Target

`skills/intuitive-reduce-entropy/scripts/*.mjs` and their tests.

## Accepted Severities

- P1: reduce-entropy skill script behavior is tested from `scripts/lib`, making
  repo-level helper tests appear to own skill internals.
- P2: future maintainers looking under the skill do not see its script tests
  next to the scripts they cover.

## Accepted Cleanup Checklist

- Move reduce-entropy script tests under `skills/intuitive-reduce-entropy/scripts`.
- Keep test behavior and command coverage unchanged.
- Avoid broad test-layout changes outside this skill.

## Parked Cross-Seam / Future Ideas

- Broader test suite organization.
- Retiring historical one-off migration tests.
- Replacing exact workflow-marker checks with behavior-shaped checks.

## Evidence Ladder

- L1: `bun test skills/intuitive-reduce-entropy/scripts/*.test.ts`
- L2: `bun run test`

## Stop Condition

Stop when the reduce-entropy script tests live beside the skill scripts, the old
`scripts/lib/reduce-entropy-*.test.ts` paths are gone, and the listed evidence
commands pass.

## Execution Log

- 2026-06-17: Created scope after read-only scout identified reduce-entropy
  tests as skill-owned coverage living under `scripts/lib`.
- 2026-06-17: Moved the high-noise summary, bounded command summary, and
  materiality gate tests under `skills/intuitive-reduce-entropy/scripts`.
  Verified with `bun test skills/intuitive-reduce-entropy/scripts/*.test.ts`
  and `bun run test`; old `scripts/lib/reduce-entropy-*.test.ts` references are
  gone.
