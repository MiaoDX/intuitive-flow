---
refactor_scope: multica-tracker-helper-cleanup
status: DONE
accepted_severities:
  - P2
last_verified: 2026-06-17
---

# Refactor Scope: Multica Tracker Helper Cleanup

## Status

DONE

## Target

Small internal helper cleanup in
`skills/multica-goal-tracker/scripts/track_goal.ts` and its focused tests.

## Accepted Severities

- P2: dead or one-line internal helpers preserve extra concepts without owning
  a distinct behavior.
- P2: duplicate preflight goal extraction branches make future parser edits
  slightly easier to drift.

## Accepted Cleanup Checklist

- Remove dead `transcriptFromCodexJsonl` wrapper and update its test to use the
  canonical `evidenceFromCodexJsonl(... )?.transcript`.
- Inline the one-line `withIssue` helper at its two call sites.
- Collapse duplicate preflight extraction branches for `Main-session /goal
  prompt` and `To execute`.
- Keep public CLI behavior, Multica commands, Codex JSONL parsing, and evidence
  rendering unchanged.

## Parked Cross-Seam / Future Ideas

- Parametrizing near-duplicate Codex goal-turn tests.
- Splitting the large tracker file.
- Broader tracker command architecture changes.

## Evidence Ladder

- L1: `bun test skills/multica-goal-tracker/scripts/track_goal.test.ts`
- Static: `bun run check`
- Final local gate: `bun run verify`

## Stop Condition

Stop when the accepted helpers are removed/simplified, focused tracker tests and
static checks pass, and no broader tracker cleanup is pulled into the slice.

## Execution Log

- 2026-06-17: Scope gate created from read-only ponytail scout evidence that
  found a dead wrapper, a one-line issue helper, and duplicate preflight parser
  branches.
- 2026-06-17: Removed the dead Codex transcript wrapper, inlined the one-line
  issue options helper, collapsed duplicate preflight extraction branches, and
  verified with focused tracker tests, `bun run check`, and `bun run verify`.
