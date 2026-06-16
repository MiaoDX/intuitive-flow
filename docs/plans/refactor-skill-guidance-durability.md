---
refactor_scope: skill-guidance-durability
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-05-15
---

# Refactor Scope: Skill Guidance Durability

## Status

DONE

Archived note: historical provenance only. This plan describes an old
`skills-src/` generation era; current implementation guidance lives in
`skills/`, `README.md`, `ARCHITECTURE.md`, `STATUS.md`, and `docs/human/**`.

## Target

Repo-owned skill guidance under `skills-src/`, non-generated root skills under
`skills/`, and the reusable durability prompt at
`docs/agents/skill-guidance-durability-prompt.md`.

## Accepted Severities

- P1: Skill guidance must keep provenance, source-of-truth boundaries, safety
      gates, and verification expectations clear.
- P2: Skill guidance should explain durable intent and suggested tactics
      instead of encoding brittle current-tool mechanics or maintainer notes.

## Accepted Cleanup Checklist

- [x] Remove or reframe meta-maintainer guidance that does not help the runtime
      agent perform the skill.
- [x] Prefer "why and evidence path" language over rigid "invoke this skill"
      mechanics where equivalent inline work is acceptable.
- [x] Keep necessary safety and provenance rules, but express them as durable
      boundaries rather than tool-specific ceremony.
- [x] Simplify `$simplify` by replacing Codex adapter mechanics with reusable
      review lenses.
- [x] Regenerate flattened `skills/intuitive-*` outputs from `skills-src/`.
- [x] Refactor `docs/agents/skill-guidance-durability-prompt.md` so it is
      durable, copy/pasteable, explicit about source-of-truth boundaries, and
      clear about local commands as repo defaults rather than universal
      ceremony.
- [x] Re-audit current repo-owned skills and refactor target-local guidance
      that encodes brittle current-tool mechanics instead of durable intent.
- [x] Reframe `$intuitive-init` init-style discovery as an optional evidence
      path, not a mandatory nested-Codex ceremony.
- [x] Reframe `$intuitive-flow` durable-run commit rhythm as recoverability
      checkpoints that respect authorization, clean boundaries, and repo
      commit policy.
- [x] Reframe `$skill-runner` post-run skill-change mechanics as source,
      verification, sync, and commit boundaries rather than an unconditional
      command recipe.
- [x] Regenerate flattened `skills/intuitive-*` outputs from `skills-src/`.
- [x] Make remaining skill command and commit examples authorization-aware
      instead of implying a universal recipe.
- [x] Fix `$skill-runner` runner path wording so agents do not infer a stale
      repo-relative command path.
- [x] Encode refactor start/stop pressure so `DONE` gates do not reopen for
      P2-only polish without explicit scope or real usage evidence.
- [x] Update related refactor routing guidance so repeated runs park
      "could be cleaner" findings instead of restarting the same seam.

## Parked Cross-Seam / Future Ideas

- Add qualitative evals that run representative tasks through each skill and
  score whether the skill improves agent behavior without over-constraining it.
- Consider moving non-generated root skills to a source/build surface if they
  start sharing substantial common doctrine.
- Qualitative pass over every skill for length and task ergonomics after this
  targeted durability cleanup.

## Evidence Ladder

- L0 Static: `bun run build:skills:check`
- L1 Unit/mock: `bun run test`
- L2 Contract: `bun run verify`

## Stop Condition

Stop when the accepted checklist is complete, generated skill output is in sync
when source skills change, the prompt no longer treats local mechanics as
universal ceremony, and `bun run verify` passes.

## Execution Log

- 2026-05-15: Audited `BELIEFS.md`, `README.md`, `ARCHITECTURE.md`, `skills-src/`,
  `skills/simplify`, and `skills/skill-runner` for brittle or overly meta skill
  guidance.
- 2026-05-15: Refactored affected skills toward durable intent, provenance,
  evidence paths, and suggested tactics.
- 2026-05-15: Reopened narrowly for
  `docs/agents/skill-guidance-durability-prompt.md`; broad skill re-audit
  remains parked.
- 2026-05-15: Refactored the durability prompt around bounded targets,
  source-of-truth boundaries, local command semantics, and installed-surface
  sync side effects. Verified with `bun run verify`.
- 2026-05-15: Reopened for the user-requested current-skills pass via
  `docs/agents/skill-guidance-durability-prompt.md`; accepted target is
  repo-owned skills only, with broad qualitative ergonomics parked.
- 2026-05-15: Refactored `$intuitive-init` init-style discovery into an
  optional evidence path, `$intuitive-flow` commit rhythm into recoverability
  checkpoints, and `$skill-runner` skill-change commands into source,
  verification, sync, and commit boundaries. Regenerated intuitive skills and
  verified with `bun run verify`.
- 2026-05-15: Reopened narrowly for command/commit example wording and
  `$skill-runner` runner path clarity after a current-skills re-audit.
- 2026-05-15: Updated `$intuitive-refactor` suggested prompt commit language,
  `$intuitive-init` Codex discovery example framing, and `$skill-runner` command
  path / skill-change command boundaries. Regenerated intuitive skills and
  verified with `bun run verify`.
- 2026-05-15: Reopened after user approval to encode stricter "when to start /
  when to stop" behavior for skill and refactor guidance.
- 2026-05-15: Added start-from-pressure and sticky-`DONE` guidance to
  `docs/agents/skill-guidance-durability-prompt.md`, `$intuitive-refactor`,
  and `$intuitive-flow`; regenerated intuitive skills and verified with
  `bun run verify`.
