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

Empty. Run a fresh discovery handoff after the managed skill state dispatcher
deletion commit lands.

## Parked Gates

- Codex config old managed status-line variants: changing migration policy may
  affect user config compatibility; safe internal slice not selected yet.
- Hook/config helper deepening: potentially useful, but current smallest slice
  may alter settings merge behavior; needs a clearer behavior-preserving seam.
- MiMoCode command-wrapper pruning drift: planning history and current tests
  disagree on ownership; needs a current owner decision before changing prune
  behavior.
- `plan-bakeoff` `base.mode` legacy no-op: documented manifest key, so removal
  needs an explicit schema/public artifact migration decision.

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
- 2026-06-23: Deleted stale `plan-bakeoff` direct provider command rendering
  helper/tests so `skill-runner` remains the only in-repo owner of real
  candidate command construction. Focused plan-bakeoff tests, `bun run check`,
  stale-reference search, and `git diff --check` passed.
- 2026-06-23: Aligned root human docs and the skill audit with the
  default-visible `plan-bakeoff` direct utility. `bun run check:skills`,
  `plan-bakeoff` reference search, and `git diff --check` passed.
- 2026-06-23: Moved repo-owned root skill state and prune-ledger artifact
  cleanup behind `owned-root-skill-state.ts`, with shared safe install-state
  helpers in `managed-skill-state-common.ts`. CLI command names, state paths,
  and deletion semantics stayed unchanged. Focused managed-state/sync tests,
  `bun run check`, and `git diff --check` passed.
- 2026-06-23: Moved `plan-bakeoff` scorecard, ranking, and final report
  formatting behind `plan_bakeoff_report.ts`. Script entrypoint, manifest
  schema, generated scorecard/report shapes, and execution behavior stayed
  unchanged. Focused plan-bakeoff tests, `bun run check`, and `git diff --check`
  passed.
- 2026-06-23: Moved the `GSD workflow` update phase implementation from
  `update-cli.sh` into `update-gsd-workflow.sh`. `scripts/update.sh` still runs
  the same `run_gsd_workflow` phase in the same order, and installer behavior,
  hook pruning, settings cleanup, and managed-state sync stayed unchanged.
  Shell syntax, managed-state tests, `bun run check:shell`, `bun run check`,
  and `git diff --check` passed.
- 2026-06-23: Moved Multica goal tracker comment markdown rendering,
  score-summary blocks, and encoded attempt marker output behind
  `track_goal_markdown.ts`. Existing finish/final-review/start/preflight/raw
  comment shapes, hidden markers, and legacy raw-json attempt parsing stayed
  unchanged. Focused Multica tracker tests, `bun run check`, and
  `git diff --check` passed.
- 2026-06-23: Fresh discovery pass 1 selected a safe internal slice from the
  remaining `update-cli.sh` phase mix. Moved the `Codex config` update phase
  into `update-codex-config.sh`; `scripts/update.sh` still runs
  `run_codex_config` under the same phase name and ordering. Shell syntax,
  Codex config tests, `bun run check:shell`, `bun run check`, and
  `git diff --check` passed.
- 2026-06-23: Fresh discovery pass 2 selected another safe internal slice from
  the remaining `update-cli.sh` phase mix. Moved Claude plugin installation and
  MCP fetch setup into `update-claude-tools.sh`; `scripts/update.sh` still runs
  `run_mcp_fetch` and `run_claude_plugins` under the same phase names and
  ordering. Shell syntax, Claude tools wiring tests, `bun run check:shell`,
  `bun run check`, and `git diff --check` passed.
- 2026-06-23: Fresh discovery selected the final safe internal `update-cli.sh`
  slice after prior phase moves. Renamed it to `update-global-cli.sh`, leaving
  `run_global_cli_tools` and `print_npm_failure_hint` as the same public update
  phase functions. Shell syntax, global CLI / Claude tools wiring tests,
  `bun run check:shell`, `bun run check`, stale-reference search, and
  `git diff --check` passed.
- 2026-06-23: Fresh discovery selected a safe bounded module-deepening slice in
  managed skill state. Moved external-source skill state, external stale-install
  pruning, and `.agents/.skill-lock.json` cleanup behind
  `external-skill-state.ts`, temporarily leaving the dispatcher CLI in place
  until the later dispatcher deletion slice. Focused managed-state/sync tests,
  `bun run check`, and `git diff --check` passed.
- 2026-06-23: Fresh discovery selected another safe managed-state lifecycle
  split. Moved GSD skill state and managed GSD wrapper pruning behind
  `gsd-skill-state.ts`, temporarily leaving the dispatcher CLI in place until
  the later dispatcher deletion slice. Focused managed-state/sync tests,
  `bun run check`, and `git diff --check` passed.
- 2026-06-23: Fresh discovery selected the final safe managed-state lifecycle
  split. Moved GStack Codex/Claude skill state, symlink ownership checks, and
  stale GStack wrapper pruning behind `gstack-skill-state.ts`, temporarily
  leaving the dispatcher CLI in place until the later dispatcher deletion
  slice. Focused managed-state/sync tests, `bun run check`, and
  `git diff --check` passed.
- 2026-06-23: Fresh discovery selected the now-stale managed skill state
  dispatcher for deletion after lifecycle ownership moved to dedicated modules.
  Migrated tracked shell callers to `gstack-skill-state.ts`,
  `gsd-skill-state.ts`, `external-skill-state.ts`, and
  `owned-root-skill-state.ts`, then deleted `managed-skill-state.ts` and
  renamed the focused lifecycle test. Focused lifecycle/sync tests,
  `bun run check:shell`, `bun run check`, stale dispatcher reference search,
  and `git diff --check` passed.
