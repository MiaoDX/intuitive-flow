---
refactor_scope: architecture-cleanup-campaign
status: CONTINUE
accepted_severities:
  - P1
  - P2
campaign_overlay: true
last_verified: 2026-06-23
---

# Refactor Scope: Architecture Cleanup Campaign

## Status

CONTINUE

## Target

Repeated behavior-preserving cleanup slices that make the repo smaller, truer,
and easier to navigate.

## Accepted Cleanup Checklist

- Delete stale surfaces whose active replacements already exist.
- Merge duplicate concept owners.
- Move behavior to canonical owners and update tracked callers.
- Remove compatibility shims when no current external contract requires them.
- Remove stale tests/docs that preserve old names instead of current behavior.
- Deepen bounded modules only when the slice improves locality or leverage.

## Verification Inventory

- Focused Bun tests for touched TypeScript helpers.
- `bun run check` for TypeScript static proof.
- `bun run check:skills` for skill/resource/doc-surface validation.
- `shellcheck --severity=error scripts/update.sh scripts/**/*.sh .githooks/pre-commit` for shell slices.
- `bun run verify` for broad final proof or public workflow changes.
- `git diff --check` before every commit.

## Rolling Candidate Queue

1. Delete stale `plan-bakeoff` direct command rendering helpers/tests now that
   `skill-runner` owns provider command construction.
2. Remove the `plan-bakeoff` `base.mode` legacy no-op after confirming no
   in-repo manifest depends on it.
3. Align human docs with the default-visible `plan-bakeoff` direct utility.
4. Shrink managed skill state ownership by moving one lifecycle slice behind a
   clearer internal owner while preserving CLI commands and state paths.

## Parked Gates

- Codex config old managed status-line variants: changing migration policy may
  affect user config compatibility; safe internal slice not selected yet.
- Hook/config helper deepening: potentially useful, but current smallest slice
  may alter settings merge behavior; needs a clearer behavior-preserving seam.
- MiMoCode command-wrapper pruning drift: planning history and current tests
  disagree on ownership; needs a current owner decision before changing prune
  behavior.

## Stop Condition

Continue through selected safe P1/P2 slices. When the queue is empty, run a
fresh discovery handoff against current `HEAD`. Stop only after two consecutive
fresh discovery handoffs, both after the latest commit, return no clear safe
P1/P2 slice after shrink attempts.

## Campaign Log

- 2026-06-23: Campaign gate created from repo entropy saturation scan and
  architecture cleanup prompt. Active capsule:
  `docs/status/active/refactor-architecture-cleanup-campaign.md`.
- 2026-06-23: Split live install allowlist kind ownership from prune-ledger kind
  ownership in `scripts/lib/default-skill-allowlist.ts`; focused allowlist
  tests, `bun run check`, and `git diff --check` passed.
