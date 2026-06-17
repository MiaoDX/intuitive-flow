---
refactor_scope: codex-native-install-spec
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-06-17
---

# Refactor Scope: Codex Native Install Spec

## Status

DONE

## Target

`scripts/lib/codex-native-package.sh` and `scripts/tasks/update-cli.sh`.

## Accepted Severities

- P1: update CLI repair/install paths reconstruct Codex native npm alias specs
  separately from the native package helper, so registry checks and install
  commands can drift.
- P2: `update-cli.sh` owns native alias string assembly even though
  `codex-native-package.sh` already owns native dependency resolution.

## Accepted Cleanup Checklist

- Add one helper that returns the complete Codex native npm install alias spec.
- Use that helper in repair command generation and global CLI update checks.
- Keep native package availability and installed-version behavior unchanged.

## Parked Cross-Seam / Future Ideas

- Unifying managed-skill-state shell wrappers.
- Broader update script decomposition.

## Evidence Ladder

- L0: `shellcheck --severity=error scripts/update.sh scripts/**/*.sh .githooks/pre-commit`
- L1: `bun run test`
- Static: `bun run check`

## Stop Condition

Stop when `update-cli.sh` no longer reconstructs Codex native alias specs from
`codex_native_package_version`, focused shell/static gates pass, and the full
Bun test suite still passes.

## Execution Log

- 2026-06-17: Created scope after read-only scout found duplicate Codex native
  package alias construction in update CLI repair and install checks.
- 2026-06-17: Added `codex_native_install_spec` as the single native alias
  owner and updated global CLI repair/install checks to consume it instead of
  rebuilding the alias locally. Verified with `shellcheck --severity=error
  scripts/update.sh scripts/**/*.sh .githooks/pre-commit`, `bun run check`,
  and `bun run test`.
