---
refactor_scope: single-default-skill-allowlist
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-06-11
---

# Refactor Scope: Single Default Skill Allowlist

## Status

DONE

## Target

The updater skill-install surface: make one canonical minimal default skill
allowlist the source of truth for repo-owned, external, GStack, and GSD skills,
then add a read-only upstream audit command for candidates outside that list.

## Accepted Severities

- P1: Default installs must no longer be split across local manifests, external
  source manifests, hardcoded GStack standard lists, and GSD profile defaults.
- P1: External skill sources must not use `all` mode for default installs.
- P1: Update runs must prune previously Intuitive-owned skills that leave the
  allowlist while preserving unowned user-installed skills.
- P2: The repo should expose a read-only upstream audit command that reports
  possible additions without mutating the allowlist.

## Accepted Cleanup Checklist

- [x] Add one canonical `scripts/default-skill-allowlist.txt`.
- [x] Route repo-owned root skill sync and legacy pruning through the allowlist.
- [x] Route external source installs through explicit allowlisted skills only.
- [x] Route GStack desired wrapper pruning through the allowlist.
- [x] Prune managed GSD wrappers to the allowlist after the upstream installer.
- [x] Add a read-only upstream skill audit command and focused tests.
- [x] Update human docs to describe the single-list contract.
- [x] Verify with focused tests and `bun run verify`.

## Parked Cross-Seam / Future Ideas

- Automatically filing an issue or PR from upstream audit output is parked; the
  first slice should only report candidates.
- Full removal of historical installed user skills without ownership evidence
  is parked; this slice should report or preserve ambiguous installs.

## Evidence Ladder

- L0 Static: `bun run check:skills`, `bun run check`, `bun run check:shell`.
- L1 Unit/mock: focused Bun tests for allowlist parsing, install args, pruning,
  and audit output shape.
- L2 Contract: `bun run verify`.

## Stop Condition

Stop when one allowlist file controls default repo-owned, external, GStack, and
GSD skill visibility; no default source uses `all`; upstream audit is read-only;
docs name the new contract; and `bun run verify` passes.

## Execution Log

- 2026-06-11: Opened after user approved the single-list plan and named the
  default keep set, including `multica-goal-tracker`,
  `intuitive-port-worktree`, `skill-creator`, and GStack browser skills.
- 2026-06-11: Implemented the single allowlist contract in
  `scripts/default-skill-allowlist.txt`, removed the old local and external
  skill manifests, routed repo-owned/external/GStack/GSD sync and pruning
  through the allowlist, and added `bun run audit:skill-upstreams` as a
  read-only candidate discovery command. Added cleanup for external source
  labels removed from the allowlist so previously managed whole-source labels
  are pruned instead of becoming silent residue.
- 2026-06-11: Verified with focused allowlist/managed-state/checker/sync tests,
  `bun run check:skills`, `bun run check`, `bun test ./scripts ./skills`,
  `bash -n` across Bash entrypoints, and `bun run audit:skill-upstreams --
  --no-clone`.
- 2026-06-11: Installed ShellCheck 0.11.0 to `~/.local/bin/shellcheck` and
  re-ran `bun run check:shell` plus full `bun run verify`; both passed.
- 2026-06-11: Applied the new allowlist locally with
  `scripts/update.sh --skip-codex-running-check`. The run executed the 3
  external source labels for both Claude Code and Codex, pruned 22 stale GSD
  wrappers, 94 stale GStack artifacts, 8 stale Anthropic external artifacts,
  and 27 stale artifacts for removed external source labels, then synced the 14
  repo-owned root skills.
