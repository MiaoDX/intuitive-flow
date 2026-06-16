---
refactor_scope: skill-self-improvement-lens
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-05-17
---

# Refactor Scope: Skill Self-Improvement Lens

## Status

DONE

Archived note: historical provenance only. References to the old local skill
manifest or generated skill sync are shipped history, not current
implementation guidance.

## Target

All repo-owned root skills listed in `scripts/local-skill-manifest.txt`, using
self-improvement as a review lens rather than as runtime prompt text.

## Accepted Severities

- P1: Skill runtime text must stay focused on executing the current task and
  avoid always-loaded maintainer meta-guidance.
- P1: The self-improvement lens must remain available to future maintainers in
  human-facing docs.
- P2: The repo should have a first-pass audit of all current root skills through
  the WHY / WHAT / HOW lens.

## Accepted Cleanup Checklist

- [x] Revert the uncommitted attempt to add self-improvement blocks to
      non-generated `simplify` and `skill-runner`.
- [x] Remove runtime self-improvement blocks from generated `intuitive-*` skill
      outputs by removing the source include.
- [x] Keep the self-improvement lens in
      `docs/human/agent-harness-references.md`.
- [x] Add a human-facing audit of all 10 repo-owned root skills.
- [x] Rebuild generated skills and verify the repo.
- [x] Sync installed Codex skill copies.

## Parked Cross-Seam / Future Ideas

- Add a manifest-backed check for WHY / WHAT / HOW clarity that does not require
  a literal runtime section in each skill.
- Move `simplify` adapter mechanics to a shared reference or generator only if
  more adapted skills need the same block.
- Split or reference-extract parts of `intuitive-flow` only after a real task
  shows its size harms execution quality.

## Evidence Ladder

- L0 Static: no root skill contains `Skill Self-Improvement Rule`
- L2 Contract: `bun run verify`
- Install sync: installed Codex copies match repo `skills/*/SKILL.md`

## Stop Condition

Stop when runtime skill text is free of the self-improvement block, the lens and
all-skill audit live under `docs/human/**`, generated skills are up to date,
verification passes, and installed Codex skill copies match repo files.

## Execution Log

- 2026-05-17: Opened after clarifying that self-improvement should be a review
  lens, not text copied into every runtime skill.
- 2026-05-17: Removed the runtime self-improvement include from all 8
  intuitive-family skill sources and deleted the shared fragment.
- 2026-05-17: Added `docs/human/skill-self-improvement-audit.md` and linked it
  from `docs/human/README.md`.
- 2026-05-17: Verified L0 by checking all 10 root skills from
  `scripts/local-skill-manifest.txt` do not contain
  `Skill Self-Improvement Rule`.
- 2026-05-17: Verified L2 with `bun run verify`: generated skills up to date,
  TypeScript check passed, and 10 Bun tests passed across 3 files.
- 2026-05-17: Synced all root skills into `/Users/fl/.codex/skills/` and
  confirmed installed copies match repo files.
