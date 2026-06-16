---
refactor_scope: local-skill-sync
status: DONE
accepted_severities:
  - P0
  - P1
last_verified: 2026-05-12
---

# Refactor Scope: Local Skill Sync

## Status

DONE

Archived note: historical provenance only. This plan predates the current
`scripts/default-skill-allowlist.txt` install surface; references to
`scripts/local-skill-manifest.txt` are not current implementation guidance.

## Target

Local skill sync from repo-owned `skills/*` through
`scripts/local-skill-manifest.txt` and
`scripts/tasks/sync-local-commands-skills.sh`.

## Accepted Severities

P0/P1 only.

## Accepted P0/P1 Checklist

- [x] P1: Add a deterministic mock-backed contract proof that listed root
      skills sync into a temp Codex skill directory without touching real
      user-level Claude/Codex config.
- [x] P1: The same proof must fail when manifest/source drift exists by keeping
      the existing manifest drift check in the exercised sync path.

## Parked P2 / Future Ideas

- Broader updater shell coverage for all `scripts/tasks/*` phases.
- Codex config rewrite tests for `scripts/lib/ensure-codex-config.ts`.
- Command-to-skill adapter escaping tests for
  `scripts/lib/codex-skill-adapter.sh`.

## Evidence Ladder

- L0 Static: `bash -n scripts/update.sh scripts/lib/*.sh scripts/tasks/*.sh scripts/support/*.sh scripts/dev/*.sh`
- L2 Contract: `bun run verify`
- L2 Contract: direct manifest check with
  `bun scripts/lib/local-skill-manifest.ts check-root-skills scripts/local-skill-manifest.txt skills`

## Stop Condition

Stop when the accepted P1 checklist passes the evidence ladder above, all
broader cleanup remains parked, and no local-only updater run is required.

## Execution Log

- 2026-05-12: Created gate from `$intuitive-refactor` dogfood pass. Status is
  `CONTINUE` until the sync contract proof and evidence ladder are green.
- 2026-05-12: Added
  `scripts/lib/sync-local-commands-skills.test.ts`, covering temp-home root
  skill sync and manifest/source drift failure through the shell task.
- 2026-05-12: Verified L0 with
  `bash -n scripts/update.sh scripts/lib/*.sh scripts/tasks/*.sh scripts/support/*.sh scripts/dev/*.sh`.
- 2026-05-12: Verified L2 with
  `bun scripts/lib/local-skill-manifest.ts check-root-skills scripts/local-skill-manifest.txt skills`.
- 2026-05-12: Verified L2 with `bun run verify`: 6 tests passed across 2 files.
