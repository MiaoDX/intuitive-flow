---
refactor_scope: intuitive-init-harness
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-06-05
---

# Refactor Scope: Intuitive Init Harness

## Status

DONE

## Target

`$intuitive-init` guidance for initializing, auditing, and refreshing
project-local agent harness files for Claude Code and Codex.

## Accepted Severities

- P1: `$intuitive-init` must preserve a correct source-of-truth hierarchy for
  repo-local agent guidance and not treat generated `/init` output as authority.
- P1: The skill must point agents toward currently valid official Claude Code,
  Codex, and AGENTS.md reference surfaces when refreshing harness guidance.
- P2: The skill should encode practical harness cleanup guidance around concise
  root files, WHY/WHAT/HOW content, hooks, nested guidance, skills, and
  team-shared MCP configuration.
- P2: Rare LSP/Serena/MCP setup detail should use progressive disclosure so
  ordinary `$intuitive-init` runs do not always load the full operational
  reference.

## Accepted Cleanup Checklist

- [x] Define agentic harness setup as the purpose of `$intuitive-init`.
- [x] Add official-source orientation for Claude Code, Codex, and AGENTS.md,
      using the live Claude docs map URL.
- [x] Keep `/init` and `codex init` as starting points, not finished output.
- [x] Add WHY/WHAT/HOW guidance for root `CLAUDE.md` and `AGENTS.md` content.
- [x] Keep root guidance concise and move longer procedures to
      `docs/agents/**`, skills, hooks, scripts, or human docs.
- [x] Prefer deterministic hooks/tools for lint and format rules rather than
      bloating root agent files.
- [x] Prefer nested `CLAUDE.md` / `AGENTS.md` files for large repos and
      monorepos.
- [x] Recommend checked-in `.mcp.json` when MCP configuration is team-shared.
- [x] Preserve the existing stdin-bundled Codex discovery fallback for hosts
      without native slash-command support.
- [x] Move detailed LSP/Serena/MCP guidance behind a referenced file while
      keeping the short default rule and stop gates in `SKILL.md`.

## Parked Cross-Seam / Future Ideas

- Add qualitative evals that run `$intuitive-init` against fixture repos and
  score produced guidance.
- Change updater behavior for installing or pruning agent harness files.
- Broader refresh of all intuitive-family skill wording around Claude Code
  2026 docs.

## Evidence Ladder

- L0 Static: `bun run check:skills`
- L1 Unit/mock: `bun run test`
- L2 Contract: `bun run verify`

## Stop Condition

Stop when the accepted checklist is complete in `skills/intuitive-init`,
referenced skill resources validate with `bun run check:skills`, `bun run
verify` passes, and only parked cross-seam ideas remain.

## Execution Log

- 2026-05-17: Opened gate for user-requested `$intuitive-init` harness guidance
  refactor. Status remains `CONTINUE` until source, generated output, and
  verification are complete.
- 2026-05-17: Added harness framing, official reference links, WHY / WHAT / HOW
  root-file guidance, hooks/scripts routing for deterministic checks, nested
  instruction guidance for large repos, team-shared MCP config guidance, and
  `codex init` wording guarded by a fallback for Codex builds without that
  subcommand.
- 2026-05-17: Regenerated `skills/intuitive-init/SKILL.md` from
  `skills-src/intuitive-init/SKILL.md`.
- 2026-05-17: Initial `bun run verify` failed because this checkout did not
  have `typescript` installed in `node_modules`; ran `bun install`.
- 2026-05-17: Verified L2 with `bun run verify`: generated skills up to date,
  TypeScript check passed, and 10 Bun tests passed across 3 files.
- 2026-05-17: Synced the generated skill to
  `/Users/fl/.codex/skills/intuitive-init/SKILL.md` and confirmed it matches
  `skills/intuitive-init/SKILL.md`.
- 2026-06-05: Reopened for a P2 progressive-disclosure pass after the user
  asked whether intuitive-family skills could be shorter without over-scripting.
  Target: extract rare LSP/Serena/MCP setup detail from
  `skills/intuitive-init/SKILL.md` into a referenced file while keeping the
  default rule loaded.
- 2026-06-05: Added
  `skills/intuitive-init/references/lsp-and-mcp.md` and reduced
  `skills/intuitive-init/SKILL.md` from 639 to 531 lines. Verified L2 with
  `bun run verify`: skill structure passed, TypeScript check passed, and 57 Bun
  tests passed.
