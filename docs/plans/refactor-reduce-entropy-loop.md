---
refactor_scope: reduce-entropy-loop
status: CONTINUE
accepted_severities:
  - P1
last_verified: 2026-06-08
---

# Refactor Scope: Reduce Entropy Loop

## Status

CONTINUE

## Target

Run `$intuitive-reduce-entropy` against the current repo until fresh audits no
longer surface P0/P1 or materially useful P2 candidates. Treat requested loop
size as a maximum, not a quota.

## Selected Candidates

- [x] P1 false confidence: `bun run check:skills` promised local skill resource
      reference coverage, but only validated links in each `SKILL.md` entrypoint.
      Links from `references/` or `templates/` Markdown files could drift while
      the normal proof boundary stayed green.

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
