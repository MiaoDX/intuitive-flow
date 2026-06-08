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
- [x] P1 live source drift: `skills/intuitive-reduce-entropy/SKILL.md` still
      listed `$intuitive-preflight` in its `Public Entry Model`, while
      `README.md`, `ARCHITECTURE.md`, and `STATUS.md` define preflight as a
      specialist or routed pre-execution contract skill.
- [x] P1 false-red verification: tmux-dependent tests gate on `tmux -V` even
      though restricted agent environments can have the binary available while
      `tmux new-session` is not usable.
- [x] P1 verification isolation: local skill sync tests stub `npx`, but still
      call the real npm registry through `select_npm_registry`, so unit-style
      verification can hang or fail on network availability instead of code
      behavior.
- [x] P2 human-doc tier drift: `BELIEFS.md` was linked as doctrine and included
      in the architecture system map while the active human truth set excluded
      it, forcing future maintainers to rediscover whether it carried current
      commands or only philosophy.
- [x] P2 stale audit coverage: `docs/human/skill-self-improvement-audit.md`
      claimed to cover every repo-owned root skill, but its table missed newer
      root skills from `scripts/local-skill-manifest.txt`.
- [x] P1 live source drift: a new `intuitive-planning-loop` root skill was
      added to the manifest and README primary table, but architecture, status,
      reduce-entropy routing guidance, and the manifest-wide skill audit still
      described the older public skill surface.
- [x] P1 live source drift: fuzzy idea routing still named `office-hours` and
      `grill-me`, but the default installed surfaces expose the repo-owned
      planning loop and `grill-with-docs` semantics rather than those entrypoint
      names.

## Saturation Audit

Selected candidates: none.

Why no change:

- `bun run verify` passes from current HEAD.
- The repo-owned skill manifest matches the live `skills/*/SKILL.md` surface.
- Human docs now agree on the small public skill surface and specialist routing,
  including `intuitive-planning-loop` as the bounded autonomous planning
  entrypoint.
- The reduce-entropy skill's public entry model now matches the human docs:
  flow, refactor, reduce-entropy, planning-loop, and squash are the user-facing
  choices, while preflight remains a specialist pre-execution contract skill.
- `BELIEFS.md` is consistently marked as supporting doctrine rather than the
  active source for current commands, installed surfaces, or maintenance state.
- `docs/human/skill-self-improvement-audit.md` covers every current root skill
  listed in `scripts/local-skill-manifest.txt`.
- Tests no longer depend on a live npm registry for local skill sync coverage,
  and tmux-dependent tests skip when tmux cannot create a detached session.
- Fuzzy idea routing no longer advertises `office-hours` or `grill-me` as
  default entrypoints when they are not part of the repo-owned or default
  managed skill surface.
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
- 2026-06-08: Reopened the loop from current `HEAD` for a completion audit.
  Selected the reduce-entropy skill's own public entry drift as P1 live source
  drift and real workflow friction. The deterministic materiality gate accepted
  it with one eligible candidate and no warnings.
- 2026-06-08: Removed `$intuitive-preflight` from the reduce-entropy skill's
  `Public Entry Model` list while keeping it in the specialist skill section.
  Verified with `bun run check:skills` and targeted source-of-truth search.
- 2026-06-08: Selected two remaining P1 verification candidates for later
  slices: tmux capability gating and local skill sync test registry isolation.
- 2026-06-08: Isolated local skill sync tests from live npm registry probes by
  stubbing the expected `npm view <package> version` call next to the existing
  `npx` stub. Verified with
  `bun test scripts/lib/sync-local-commands-skills.test.ts`.
- 2026-06-08: Centralized tmux test capability detection on a real detached
  session probe instead of `tmux -V`, and added regression coverage for a host
  where the binary exists but session creation fails. Verified with
  `bun test scripts/lib/test-capabilities.test.ts scripts/lib/intuitive-flow-stop-gate.test.ts scripts/lib/skill-runner.test.ts scripts/dev/tmux-watchdog.test.ts`
  and `bun run check`.
- 2026-06-08: Clarified `BELIEFS.md` as supporting doctrine rather than the
  active source for current commands, installed surfaces, or maintenance state.
  Refreshed the skill self-improvement audit to cover the current root-skill
  manifest, including `grill-with-docs-batch`, `intuitive-port-worktree`, and
  `intuitive-preflight`. Verified with targeted doc-tier searches,
  manifest-vs-audit coverage, and `bun run verify`.
- 2026-06-08: Ran a fresh saturation audit from `HEAD`. Verified full local
  proof with `bun run verify` (76 tests across 12 files), checked plan statuses,
  confirmed root skill manifest coverage in the self-improvement audit, checked
  `BELIEFS.md` tier wording, and reviewed noisy stale/legacy/skip search hits.
  No remaining observation passed the materiality contract, so the loop is
  closed with `Selected candidates: none`.
- 2026-06-08: Reopened the loop from current `HEAD` after a new
  `intuitive-planning-loop` root skill appeared in the manifest and README.
  Selected public skill surface drift as P1 live source drift and real workflow
  friction. Aligned `ARCHITECTURE.md`, `STATUS.md`, the reduce-entropy public
  entry model, the manifest-wide skill audit, and the public-skill addition
  checklist around the new primary planning entrypoint.
- 2026-06-08: Selected fuzzy idea routing drift as P1 live source drift after
  the post-commit skill-surface audit found `office-hours` and `grill-me`
  references unsupported by the default installed surfaces. Reworded README and
  `$intuitive-flow` planning references to route through inline flow shaping,
  `$intuitive-planning-loop`, and `grill-with-docs` semantics instead.
  Verified no repo-owned `office-hours` / `grill-me` references remain and
  `bun run verify` passes.
