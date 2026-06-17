---
refactor_scope: legacy-planning-loop-test-vocabulary
status: DONE
accepted_severities:
  - P2
last_verified: 2026-06-17
---

# Refactor Scope: Legacy Planning Loop Test Vocabulary

## Status

DONE

## Target

`scripts/lib/default-skill-allowlist.test.ts` and
`scripts/lib/sync-local-commands-skills.test.ts`.

## Accepted Severities

- P2: focused tests preserve the old `intuitive-planning-loop` migration name
  as special maintenance vocabulary even though the durable behavior is generic
  current-root allowlist plus prune-ledger cleanup.

## Accepted Cleanup Checklist

- Keep prune-ledger parsing and pruning behavior covered with generic fixture
  names.
- Keep root-skill drift detection covered without the historical planning-loop
  name.
- Keep live sync proving allowlisted root skills install and current prune-ledger
  entries are not installed.
- Do not edit the live prune ledger or human docs in this slice.

## Parked Cross-Seam / Future Ideas

- Demoting retired-name explanations from root human docs.
- Broader test suite organization.
- Shared shell helper cleanup for managed skill state wrapper calls.

## Evidence Ladder

- L1: `bun test scripts/lib/default-skill-allowlist.test.ts scripts/lib/sync-local-commands-skills.test.ts`
- L2: `bun run verify`

## Stop Condition

Stop when tests no longer hard-code `intuitive-planning-loop`, generic
allowlist/prune-ledger behavior remains covered, and the evidence ladder passes.

## Execution Log

- 2026-06-17: Created scope after remaining cleanup scan found historical
  planning-loop migration vocabulary in generic allowlist/sync tests.
- 2026-06-17: Replaced planning-loop-specific fixtures with generic legacy
  names, removed the redundant rename-specific test case, and made the sync
  test assert all prune-ledger legacy skills are absent from installed root
  skills. Verified with `bun test scripts/lib/default-skill-allowlist.test.ts
  scripts/lib/sync-local-commands-skills.test.ts`.
