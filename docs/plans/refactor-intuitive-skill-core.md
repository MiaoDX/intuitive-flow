---
refactor_scope: intuitive-skill-core
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-05-17
---

# Refactor Scope: Intuitive Skill Core

## Status

DONE

Current note, 2026-06-15: the generated `skills-src/` authoring model described
in the original execution log has since been retired. The live source of truth
is now `skills/<name>/SKILL.md`; `bun run check:skills` rejects non-empty
`skills-src/` as deprecated source. Keep the historical log below as provenance,
not as current implementation guidance.

## Target

The repo-owned `intuitive-*` skills under `skills/`, specifically the repeated
lower-level guidance around source-of-truth boundaries, audit/propose/apply
flow, compatibility cleanup, evidence ladders, and human-vs-agent doc surfaces.

## Accepted Severities

- P1: Generated skill outputs must remain deterministic and self-contained for
  both Claude Code and Codex install paths.
- P1: Verification must fail when generated skill outputs drift from their
  source templates.
- P2: Repeated intuitive family policy should have one authoring source where
  practical without introducing runtime cross-skill imports.

## Accepted Cleanup Checklist

- [x] Add a `skills-src/` authoring surface with shared intuitive common
      fragments.
- [x] Keep `skills/*/SKILL.md` as flattened standalone install output.
- [x] Add a Bun TypeScript builder/checker that expands shared fragments and
      copies bundled skill resources.
- [x] Wire deterministic generated-output checking into the normal verification
      command.
- [x] Update human docs so future contributors know `skills-src/` is the
      authoring source and `skills/` is generated install output.
- [x] Evaluate a shared self-improvement contract for intuitive-family skills
      and keep it as a human maintainer lens instead of runtime-loaded skill
      text.
- [x] Make future skill reviews preserve a concise WHY / WHAT / HOW shape: why
      the skill exists, what surfaces it owns, and how it executes and verifies.
- [x] Create a human-facing reference page that records official agent-harness
      sources and what each source teaches this repo.
- [x] Link the new reference page from the human docs index and root docs where
      humans look for repo doctrine.

## Parked Cross-Seam / Future Ideas

- Convert non-intuitive skills to the same source/build pattern.
- Add qualitative skill evals for every intuitive skill after the build
  pipeline is stable.
- Replace the custom lightweight include syntax if Codex later gains a native
  runtime import mechanism compatible with Claude Code `@import`.
- Add hook/plugin/LSP setup implementation after the repo has a concrete
  default pattern worth distributing.
- Add fixture-based checks for WHY / WHAT / HOW clarity without requiring a
  literal runtime section in every skill.

## Evidence Ladder

- L0 Static: `bun run build:skills:check`
- L1 Unit/mock: `bun run test`
- L2 Contract: `bun run verify`

## Stop Condition

Stop when the accepted checklist is complete, `skills/` is reproducibly
generated from `skills-src/`, `bun run verify` passes, and runtime skill
consumers still read standalone files from `skills/`.

## Execution Log

- 2026-05-14: Opened gate after user approved the generated flattened skills
  refactor for shared intuitive skill logic.
- 2026-05-14: Added `skills-src/` templates and
  `skills-src/intuitive-common/*.md` shared fragments for source-of-truth,
  bounded proposal, canonical cleanup, and human/agent surface rules.
- 2026-05-14: Added `scripts/lib/build-intuitive-skills.ts` plus tests for
  fragment expansion, resource copying, stale output detection, stale generated
  directory detection, and unsafe include rejection.
- 2026-05-14: Wired `bun run build:skills:check` into `bun run verify` and
  updated `README.md`, `ARCHITECTURE.md`, and `STATUS.md` with the generated
  skill authoring contract.
- 2026-05-14: Verified with `bun run build:skills:check`, `bun run check`,
  `bun test scripts/lib/build-intuitive-skills.test.ts`, `bun run verify`, and
  `bun scripts/lib/local-skill-manifest.ts check-root-skills
  scripts/local-skill-manifest.txt skills`.
- 2026-05-17: Reopened after the user expanded the generated-skill core scope
  from `$intuitive-init` harness guidance to all intuitive-family skills. New
  accepted cleanup adds a shared self-improvement rule and a human-facing
  harness reference page.
- 2026-05-17: Added `skills-src/intuitive-common/self-improvement.md` and loaded
  it from all 8 intuitive-family source skills.
- 2026-05-17: Created
  `docs/human/agent-harness-references.md` with official and field-practice
  sources, including the May 14, 2026 Claude Code large-codebase post.
- 2026-05-17: Linked the reference page from `README.md`,
  `ARCHITECTURE.md`, `STATUS.md`, and `docs/human/README.md`.
- 2026-05-17: Regenerated all 8 intuitive skill outputs with
  `bun run build:skills`.
- 2026-05-17: Verified L2 with `bun run verify`: generated skills up to date,
  TypeScript check passed, and 10 Bun tests passed across 3 files.
- 2026-05-17: Synced all regenerated intuitive skills into
  `/Users/fl/.codex/skills/` and confirmed they match the repo outputs.
- 2026-05-17: Corrected the self-improvement design after review: the rule is a
  maintainer lens, not runtime text. Removed the generated
  `Skill Self-Improvement Rule` blocks from `intuitive-*` skills and moved the
  durable guidance to human docs.
