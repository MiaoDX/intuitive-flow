---
refactor_scope: skill-checker-portability
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-06-17
---

# Refactor Scope: Skill Checker Portability

## Status

DONE

## Target

`scripts/lib/check-skills.ts` and its focused tests.

## Accepted Severities

- P1: `check:skills` hard-codes one checkout path when rejecting machine-local
  paths in canonical skill files, so the verifier can pass stale absolute
  checkout references in any other clone.
- P2: the focused test preserves that one-machine assumption instead of proving
  the checker follows the project root under test.

## Accepted Cleanup Checklist

- Derive the forbidden checkout root from the configured `skillsRoot`.
- Update the focused test to use the temporary fixture root.
- Remove the hard-coded `/home/mi/ws/intuitive-flow` checker constant.
- Keep the rest of skill validation behavior unchanged.

## Parked Cross-Seam / Future Ideas

- Turning the non-failing skill size report into an enforced budget.
- Thinning oversized skill entrypoints.
- Broader docs cleanup around verifier guarantees.

## Evidence Ladder

- L1: `bun test scripts/lib/check-skills.test.ts`
- L2: `bun run check:skills`
- Static: `bun run check`

## Stop Condition

Stop when the checker no longer contains a developer-specific checkout path,
the focused test proves temp-checkout absolute paths are rejected, and the
listed evidence commands pass.

## Execution Log

- 2026-06-17: Created scope after identifying hard-coded checkout path
  validation as a verifier false-green risk.
- 2026-06-17: Derived machine-local path detection from `skillsRoot`, updated
  the temp-project test to prove non-default checkout roots are rejected, and
  removed the hard-coded developer checkout path from the checker. Verified
  with `bun test scripts/lib/check-skills.test.ts`, `bun run check:skills`,
  and `bun run check`.
