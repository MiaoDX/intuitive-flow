---
refactor_scope: allowlist-prune-ledger
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-06-17
---

# Refactor Scope: Allowlist / Prune Ledger Boundary

## Status

DONE

## Target

`scripts/lib/default-skill-allowlist.ts` and direct callers/tests.

## Accepted Severities

- P1: the live install allowlist type still carries prune-only `legacy*`
  fields even though current docs define `scripts/default-skill-prune-ledger.txt`
  as the separate retired-artifact owner.
- P2: test/docs wording may still imply one parser/type owns both current
  installs and prune-only retired artifacts.

## Accepted Cleanup Checklist

- Split live install allowlist and prune-ledger types/parsers.
- Keep updater CLI commands behavior-compatible for current shell callers.
- Remove `legacy*` fields from `DefaultSkillAllowlist`.
- Update focused tests so they prove the split boundary.
- Keep broader install, GStack/GSD, and external skill behavior unchanged.
- Move destructive prune-ledger artifact deletion out of the allowlist parser
  and into the managed install-state owner.

## Parked Cross-Seam / Future Ideas

- Broader human-doc de-duplication of default skill governance.
- Reassessing whether ponytail trial skills should be promoted or removed.
- Large skill/test file thinning that is only line-count motivated.

## Evidence Ladder

- L1: `bun test scripts/lib/default-skill-allowlist.test.ts scripts/lib/check-skills.test.ts scripts/lib/sync-local-commands-skills.test.ts scripts/lib/managed-skill-state.test.ts`
- L2: `bun run check:skills`
- Final local gate: `bun run verify`

## Stop Condition

Stop when `DefaultSkillAllowlist` has no prune-only legacy fields, prune-ledger
commands still operate on `scripts/default-skill-prune-ledger.txt`, all focused
tests pass, `bun run verify` passes, and parked ideas remain unimplemented.

## Execution Log

- 2026-06-17: Scope gate created after read-only scouts identified the
  allowlist/prune-ledger split as the highest-value bounded cleanup slice.
- 2026-06-17: Split prune-ledger parsing from the live install allowlist type.
  `DefaultSkillAllowlist` no longer carries `legacy*` fields; `prune` now reads
  a `PruneLedger` explicitly, while current install commands still read the
  default allowlist.
- 2026-06-17: Updated tests and architecture proof-boundary wording to reflect
  the separated install allowlist / prune-ledger boundary.
- 2026-06-17: Verified with:
  `bun test scripts/lib/default-skill-allowlist.test.ts scripts/lib/check-skills.test.ts scripts/lib/sync-local-commands-skills.test.ts scripts/lib/managed-skill-state.test.ts`;
  `bun run check:skills`; `bun run check`.
- 2026-06-17: Reopened after the owned-root state cleanup made the remaining
  owner split clear: prune-ledger parsing belongs in the allowlist module, but
  destructive installed-artifact deletion still belongs with managed install
  state.
- 2026-06-17: Moved destructive prune-ledger artifact deletion to
  `managed-skill-state.ts`, kept prune-ledger parsing and validation in
  `default-skill-allowlist.ts`, and updated sync shell calls to use
  `prune-legacy-artifacts`. Verified with:
  `bun test scripts/lib/default-skill-allowlist.test.ts scripts/lib/managed-skill-state.test.ts scripts/lib/sync-local-commands-skills.test.ts scripts/lib/check-skills.test.ts`;
  `bun run check`; `shellcheck --severity=error scripts/update.sh scripts/**/*.sh .githooks/pre-commit`;
  `bun run check:skills`; and `bun run verify`.
