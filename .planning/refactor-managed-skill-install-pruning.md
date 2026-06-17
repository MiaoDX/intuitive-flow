---
refactor_scope: managed-skill-install-pruning
status: DONE
accepted_severities:
  - P1
last_verified: 2026-06-17
---

# Refactor Scope: Managed Skill Install Pruning

## Status

DONE

## Target

Managed-state stale install cleanup in `scripts/lib/managed-skill-state.ts`
and focused managed-state / sync tests.

## Accepted Severities

- P1: repo-owned root skills removed from the allowlist can leave generated
  MiMoCode command wrappers reachable after owned-root pruning.
- P1: external skills removed from an allowlist label or removed source label
  can leave Codex installs under `~/.codex/skills` even though update installs
  external labels for both Claude Code and Codex.

## Accepted Cleanup Checklist

- Remove MiMoCode command wrappers for previously owned root skills when they
  leave the root allowlist.
- Remove Codex external skill installs during `external-sync` stale-skill
  pruning.
- Remove Codex external skill installs during `external-prune-removed` source
  label pruning.
- Keep pruning guarded by prior managed state and safe skill names.
- Preserve user-owned/untracked skill installs.
- Update focused tests so stale Codex and MiMoCode surfaces are covered.

## Parked Cross-Seam / Future Ideas

- Broader managed-state module splitting.
- GStack/GSD generated-wrapper policy changes.
- Shell task decomposition outside the stale install paths.

## Evidence Ladder

- L1: `bun test scripts/lib/managed-skill-state.test.ts scripts/lib/sync-local-commands-skills.test.ts`
- Static: `bun run check`
- Final local gate: `bun run verify`

## Stop Condition

Stop when every accepted stale install surface is pruned from the managed-state
owner, focused tests prove the missing Codex and MiMoCode paths, full
verification passes, and unrelated managed-state cleanup remains parked.

## Execution Log

- 2026-06-17: Scope gate created after read-only code scout found stale
  reachable install surfaces for removed repo-owned MiMoCode wrappers and
  removed external Codex skill installs.
- 2026-06-17: Added managed-state pruning for removed repo-owned MiMoCode
  wrappers and removed external Codex installs in both stale-skill and
  removed-source paths. Verified with focused managed-state/sync tests,
  `bun run check`, and `bun run verify`.
