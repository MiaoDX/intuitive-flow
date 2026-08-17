# Status

Last reviewed: 2026-08-06

## Current State

`intuitive-flow` is a portable workflow kit for Claude Code and Codex. The repo
currently provides:

- root human docs and starter agent guidance
- a human-facing agent harness reference ledger in
  `docs/human/agent-harness-references.md`
- reusable installed skills under `skills/`
- a routed `cross-review` skill for bounded second opinions on existing agent
  proposals before heavier planning or preflight
- compact runtime skill entrypoints backed by on-demand `references/`,
  `templates/`, and `scripts/`
- portable durable-run ownership that preserves target-repo status conventions,
  isolates task state, and keeps shared project status single-writer
- a Flow-owned plan prose gate that runs an STE-flavored shadow check after
  decision reconciliation and before preflight or execution handoff, with
  summary-only local JSONL trial memory and a seven-day report
- a single default skill install allowlist at
  `scripts/default-skill-allowlist.txt`
- a separate prune-only ledger for retired local artifacts at
  `scripts/default-skill-prune-ledger.txt`
- update and sync automation under `scripts/`
- repo-owned Git hooks under `.githooks/`
- Bun TypeScript helpers and tests under `scripts/lib/`
- a GitHub Actions verification workflow under `.github/workflows/verify.yml`
- local workstation utilities under `scripts/dev/`
- vendored GSD and gstack tooling under `vendor/`

The authoritative human surface is `README.md`, `ARCHITECTURE.md`, `STATUS.md`,
and `docs/human/**`.

## Working Commands

Use these for local development:

```bash
bun install
bun run setup:hooks
bun run verify
```

Use this only when intentionally updating global/local agent tooling:

```bash
./scripts/update.sh
```

`scripts/update.sh` writes outside the repo into user-level tool directories and
config, including Claude, Codex, skill installs, and vendored gstack setup. It
warns but continues when Codex is already running; restart existing Codex
sessions after update to pick up refreshed config, hooks, and skills.

## Active Focus

The current maintenance focus is keeping the repo dogfoodable:

- keep the human surface small and accurate; Flow treats 120 lines as a status
  cleanup budget and 200 lines as a hard closeout limit
- keep `docs/human/agent-harness-references.md` as the source ledger before
  field lessons become skill rules
- route tiny work directly to Flow; use preflight and planning scouts only for
  material ambiguity or risk, then execute through Flow
- keep post-proposal second opinions in `cross-review` instead of expanding
  them into a full planning loop
- keep the primary user-facing routes to Flow, Refactor, and Reduce Entropy;
  route specialist skills on demand
- keep install and prune policy explicit in the two ledgers under `scripts/`
- keep plan-prose checks in report-only shadow mode until fixture and live proof
  show readability gains without protected-contract regressions
- keep durable task state target-local: one task control plane per task, workers
  return evidence, and only an explicit project integrator writes shared status
- keep skill entrypoints compact, local hooks and CI aligned, and verify with
  `bun run verify`

Active execution state lives only in the task-owned surface selected for a
running durable task. Completed capsules leave the active namespace after
canonical evidence is reconciled. Historical `.planning/**` files remain
locked summaries, not the active roadmap.

## Known Boundaries

- `docs/assets/**` supports rendered docs and should not carry authoritative
  prose by itself.
- `vendor/**`, `node_modules/**`, and `.venv/**` are dependency or local
  environment surfaces, not human docs.
- `scripts/update.sh` is not a harmless test command; it mutates installed tools
  and user config. By default it warns rather than blocks when Codex is already
  running.
- Skill visibility is controlled by `scripts/default-skill-allowlist.txt`;
  default and routed entries install normally, on-demand entries require
  explicit selection, external entries are host-scoped, and prune-only
  `legacy-*` entries belong in `scripts/default-skill-prune-ledger.txt`.
- GSD and GStack setup may create upstream wrappers temporarily, but the updater
  prunes managed wrappers back to the default allowlist.
- `skills/` is the canonical repo-owned skill source; `scripts/update.sh`
  mirrors allowlisted repo-owned skills into installed host surfaces.
- Skill sync creates missing host skill roots and mirrors `_shared` resources,
  but installation does not create or migrate status artifacts in target repos.
- Plan prose shadow checks store summary-only trial events under the user-local
  XDG state directory. They do not store plan prose, mutate target repos, or
  upload telemetry.
- `.githooks/pre-commit` is opt-in per checkout through `bun run setup:hooks`
  because Git does not version local hook configuration.

## Next Maintenance

- Add focused tests when updater behavior changes.
- Update this file when supported commands, install surfaces, or the active
  project focus changes.
- Update `ARCHITECTURE.md` when a new subsystem, public contract, proof boundary,
  or extension point appears.
