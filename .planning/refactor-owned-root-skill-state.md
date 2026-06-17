---
refactor_scope: owned-root-skill-state
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-06-17
---

# Refactor Scope: Owned Root Skill State

## Status

DONE

## Target

Repo-owned root skill ownership state, currently split between
`scripts/lib/default-skill-allowlist.ts`, `scripts/lib/managed-skill-state.ts`,
and `scripts/tasks/sync-local-commands-skills.sh`.

## Accepted Severities

- P1: `owned-root-skills.json` is managed-skill ownership state but is still
  read, pruned, and written by the default allowlist parser CLI.
- P2: focused tests for owned root skill state live beside allowlist parsing
  tests instead of the managed-state behavior they prove.

## Accepted Cleanup Checklist

- Move owned root skill state read/prune/record behavior into
  `managed-skill-state.ts`.
- Keep `owned-root-skills.json` schema and file path unchanged.
- Update sync shell to call the managed-state CLI for owned root state.
- Move focused owned-root state tests to `managed-skill-state.test.ts`.
- Keep prune-ledger parsing/removal in `default-skill-allowlist.ts`.
- Keep external, GStack, GSD, and root skill allowlist parsing behavior
  unchanged.

## Parked Cross-Seam / Future Ideas

- Broader `managed-skill-state.ts` decomposition.
- External/GStack/GSD policy changes.
- Line-count-only file splitting.

## Evidence Ladder

- L1: `bun test scripts/lib/default-skill-allowlist.test.ts scripts/lib/managed-skill-state.test.ts scripts/lib/sync-local-commands-skills.test.ts`
- Static: `bun run check`
- Final local gate if touched scope expands: `bun run verify`

## Stop Condition

Stop when `default-skill-allowlist.ts` no longer exports or dispatches owned
root state operations, sync still records and prunes owned root skill installs
through `managed-skill-state.ts`, the state file format remains unchanged, and
the focused evidence ladder passes.

## Execution Log

- 2026-06-17: Scope gate created after repeated prior gates parked
  managed-skill-state wrapper cleanup and current code showed
  `owned-root-skills.json` ownership split across the allowlist parser and
  managed-state module.
- 2026-06-17: Moved owned-root skill state pruning and recording into
  `managed-skill-state.ts`, kept the existing `owned-root-skills.json` shape,
  updated sync shell calls to the managed-state CLI, and moved focused state
  tests out of allowlist parser tests. Verified with:
  `bun test scripts/lib/default-skill-allowlist.test.ts scripts/lib/managed-skill-state.test.ts scripts/lib/sync-local-commands-skills.test.ts`;
  `bun run check`; `shellcheck --severity=error scripts/update.sh scripts/**/*.sh .githooks/pre-commit`;
  `bun run check:skills`; and `bun run verify`.
