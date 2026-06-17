---
refactor_scope: shared-source-normalization
status: DONE
accepted_severities:
  - P2
last_verified: 2026-06-17
---

# Refactor Scope: Shared Source Normalization

## Status

DONE

## Target

External skill source normalization shared by
`scripts/lib/default-skill-allowlist.ts` and
`scripts/lib/managed-skill-state.ts`.

## Accepted Severities

- P2: duplicate external source normalization can drift between allowlist
  validation and managed-state cleanup.

## Accepted Cleanup Checklist

- Keep `default-skill-allowlist.ts` as the owner of `normalizeSource`.
- Remove the duplicate `normalizeSource` implementation from
  `managed-skill-state.ts`.
- Import and use the allowlist-owned helper from managed state.
- Keep external skill allowlist parsing, state recording, and skill-lock
  pruning behavior unchanged.

## Parked Cross-Seam / Future Ideas

- Broader managed-state decomposition.
- Shell wrapper consolidation in sync/update tasks.
- Larger allowlist parser reshaping.

## Evidence Ladder

- L1: `bun test scripts/lib/default-skill-allowlist.test.ts scripts/lib/managed-skill-state.test.ts`
- Static: `bun run check`
- Final local gate: `bun run verify`

## Stop Condition

Stop when there is one external source normalization owner, managed-state
callers use it directly, focused tests and static checks pass, and no broader
managed-state cleanup is pulled into the slice.

## Execution Log

- 2026-06-17: Scope gate created after saturation discovery and the
  materiality gate accepted duplicate external source normalization as a
  workflow-drift P2.
- 2026-06-17: Removed the duplicate managed-state `normalizeSource` helper and
  imported the allowlist-owned helper instead. Verified with focused
  allowlist/managed-state tests, `bun run check`, and `bun run verify`.
