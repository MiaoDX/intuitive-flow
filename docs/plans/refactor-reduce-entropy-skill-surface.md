---
refactor_scope: reduce-entropy-skill-surface
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-05-17
---

# Refactor Scope: Reduce Entropy Skill Surface

## Status

DONE

Archived note: historical provenance only. This plan predates the current
direct `skills/` source layout and `scripts/default-skill-allowlist.txt`
install surface.

## Target

The user-facing Intuitive Flow skill surface: reduce the number of primary
skills while keeping specialist capability available behind a smaller routing
surface.

## Accepted Severities

- P1: The public skill model must make the common user choice clear:
  build something, clean a known target, or ask the agent what repo entropy to
  reduce next.
- P1: Removing `$intuitive-layout` must not lose its core safety rules around
  path consumers, single-slice moves, stale wrappers, and verification.
- P2: Specialist skills such as `$intuitive-doc`, `$intuitive-init`, and
  `$intuitive-tests` should remain available but move out of the primary user
  path.

## Accepted Cleanup Checklist

- [x] Rename `$intuitive-migrate` to `$intuitive-reduce-entropy` with new
      semantics: periodic repo entropy check and one recommended cleanup slice.
- [x] Delete `$intuitive-layout` as an independent root skill.
- [x] Migrate only core layout routing rules:
      docs layout -> `$intuitive-doc`, tests layout -> `$intuitive-tests`,
      code/package/module layout -> `$intuitive-refactor`, repo-wide mixed
      surfaces -> `$intuitive-reduce-entropy`.
- [x] Update README primary skills to `flow`, `refactor`, `reduce-entropy`, and
      `squash`, with `doc/init/tests` as specialist skills.
- [x] Update manifest roots and legacy removals.
- [x] Update human docs, status, architecture, and skill audit.
- [x] Regenerate generated skill outputs and verify.
- [x] Sync installed Codex skills and remove deleted installed skill copies.

## Parked Cross-Seam / Future Ideas

- Add a command or manifest grouping that distinguishes primary, utility, and
  specialist skills mechanically.
- Add qualitative evals for `$intuitive-reduce-entropy` against messy fixture
  repos.
- Further slim `$intuitive-flow` only after real task evidence shows its length
  harms execution.

## Evidence Ladder

- L0 Static: `bun run build:skills:check`
- L1 Unit/mock: `bun run test`
- L2 Contract: `bun run verify`
- Install sync: installed Codex skill copies match repo roots and deleted names
  are absent.

## Stop Condition

Stop when the old `$intuitive-migrate` and `$intuitive-layout` root skills are
gone, `$intuitive-reduce-entropy` is generated and documented as the maintenance
entrypoint, core layout rules are routed to their owners, `bun run verify`
passes, and installed Codex skills match the repo.

## Execution Log

- 2026-05-17: Opened after grill-me convergence on the three primary entrypoints:
  `$intuitive-flow`, `$intuitive-refactor`, and
  `$intuitive-reduce-entropy`, with `$intuitive-squash` as a utility and
  doc/init/tests as specialist skills.
- 2026-05-17: Added `skills-src/intuitive-reduce-entropy/SKILL.md`, deleted
  `skills-src/intuitive-migrate/SKILL.md` and
  `skills-src/intuitive-layout/SKILL.md`, and regenerated `skills/`.
- 2026-05-17: Updated `README.md`, `ARCHITECTURE.md`, `STATUS.md`,
  `docs/human/README.md`, `docs/human/reduce-repo-entropy.md`,
  `docs/human/skill-self-improvement-audit.md`, and
  `scripts/local-skill-manifest.txt`.
- 2026-05-17: Migrated layout safety rules to `$intuitive-reduce-entropy`,
  `$intuitive-doc`, `$intuitive-tests`, and `$intuitive-refactor` instead of
  preserving a standalone layout skill.
- 2026-05-17: Verified L2 with `bun run verify`: generated skills up to date,
  TypeScript check passed, and 10 Bun tests passed across 3 files.
- 2026-05-17: Ran `scripts/tasks/sync-local-commands-skills.sh`; 9 root skills
  synced and legacy `intuitive-layout` / `intuitive-migrate` installs removed.
