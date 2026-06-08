---
refactor_scope: reduce-entropy-loop
status: DONE
accepted_severities:
  - P1
last_verified: 2026-06-08
---

# Refactor Scope: Reduce Entropy Loop

## Status

DONE

## Target

Run `$intuitive-reduce-entropy` against the current repo until fresh audits no
longer surface P0/P1 or materially useful P2 candidates. Treat requested loop
size as a maximum, not a quota.

## Selected Candidates

- [x] P1 false confidence: `bun run check:skills` promised local skill resource
      reference coverage, but only validated links in each `SKILL.md` entrypoint.
      Links from `references/` or `templates/` Markdown files could drift while
      the normal proof boundary stayed green.
- [x] P1 live source drift: `README.md` listed `$intuitive-preflight` as a
      primary skill row while `ARCHITECTURE.md` and `STATUS.md` define the small
      public surface as flow, refactor, reduce-entropy, and squash, with
      preflight as a routed specialist/pre-execution contract skill.

## Saturation Audit

Selected candidates: none.

Why no change:

- `bun run verify` passes from current HEAD.
- The repo-owned skill manifest matches the live `skills/*/SKILL.md` surface.
- Human docs now agree on the small public skill surface and specialist routing.
- Remaining `stale`, `legacy`, `skip`, and `compatibility` search hits are
  intentional policy text, tests, fixtures, completed plan history, or updater
  runtime messages rather than current false confidence or live source drift.
- The only open plan was this loop gate; all other `docs/plans/*.md` gates are
  marked `DONE`.

Parked items:

- Future updater shell coverage remains parked in older done gates until a real
  updater behavior change makes it material.
- Broader qualitative skill evals remain parked until fixture evidence shows a
  recurring failure mode.

## Evidence Ladder

- Materiality gate:
  `node skills/intuitive-reduce-entropy/scripts/materiality-gate.mjs <candidate.json>`
- Narrow proof: `bun test scripts/lib/check-skills.test.ts`
- Contract proof: `bun run check:skills`
- Full proof: `bun run verify`

## Stop Condition

Stop when a fresh saturation audit returns `Selected candidates: none`, meaning
the remaining observations are only wording polish, speculative cleanup,
already-covered work, or tiny niceties that would not prevent future surprise.

## Execution Log

- 2026-06-08: Opened the loop gate after the user asked to continue reducing
  entropy and commit each coherent refactor slice until no obvious candidates
  remain.
- 2026-06-08: Selected the skill resource link gate as P1 false confidence.
  The deterministic materiality gate accepted it with one eligible candidate and
  no warnings.
- 2026-06-08: Added a red test proving `checkSkills` missed a broken relative
  link from a skill reference file, then extended the checker to validate
  Markdown links in all skill Markdown files.
- 2026-06-08: Verified with `bun test scripts/lib/check-skills.test.ts`,
  `bun run check:skills`, and `bun run verify`: 74 tests passed across 11 files.
- 2026-06-08: Selected the README primary skill surface drift as P1 live source
  drift and real workflow friction. The deterministic materiality gate accepted
  it with one eligible candidate and no warnings.
- 2026-06-08: Removed `$intuitive-preflight` from the README primary skill table
  while keeping it in the specialist/direct-use paragraph, matching
  `ARCHITECTURE.md` and `STATUS.md`.
- 2026-06-08: Ran a fresh saturation audit after the README slice. Verified the
  manifest/skill surface, human docs, plan statuses, link surfaces, and noisy
  stale/legacy search hits. No remaining observation passed the materiality
  contract, so the loop closed early with `Selected candidates: none`.
