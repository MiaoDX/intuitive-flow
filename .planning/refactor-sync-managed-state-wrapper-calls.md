---
refactor_scope: sync-managed-state-wrapper-calls
status: DONE
accepted_severities:
  - P2
last_verified: 2026-06-17
---

# Refactor Scope: Sync Managed-State Wrapper Calls

## Status

DONE

## Target

Private managed-state command wrappers in
`scripts/tasks/sync-local-commands-skills.sh` and the focused script-presence
test in `scripts/lib/managed-skill-state.test.ts`.

## Accepted Severities

- P2: one-call shell wrappers add private vocabulary around managed-state
  commands and force tests to preserve the wrapper names instead of the
  executable workflow command surface.

## Accepted Cleanup Checklist

- Remove `_remove_stale_local_artifacts`, `_remove_stale_owned_root_skills`,
  and `_record_owned_root_skills`.
- Call `_managed_state_tool` directly for prune-ledger cleanup, owned-root
  pruning, and owned-root recording.
- Keep the missing prune-ledger file guard.
- Update the focused test to assert direct managed-state command calls.
- Keep sync behavior and managed-state CLI behavior unchanged.

## Parked Cross-Seam / Future Ideas

- Broader shell task decomposition.
- Managed-state module splitting.
- Line-count-only shell cleanup.

## Evidence Ladder

- L1: `bun test scripts/lib/managed-skill-state.test.ts`
- L0: `shellcheck --severity=error scripts/update.sh scripts/**/*.sh .githooks/pre-commit`
- Final local gate: `bun run verify`

## Stop Condition

Stop when the sync task no longer has one-call managed-state wrapper functions,
the focused test protects the direct command surface, shellcheck and full
verification pass, and no broader shell cleanup is pulled into the slice.

## Execution Log

- 2026-06-17: Scope gate created after saturation discovery and materiality
  gate accepted the wrappers as recurring workflow vocabulary around
  managed-state commands.
- 2026-06-17: Removed the one-call shell wrappers, kept the prune-ledger
  existence guard, updated the focused script-wiring test to assert direct
  managed-state command calls, and verified with focused managed-state tests,
  shellcheck, and `bun run verify`.
