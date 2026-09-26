# Status

Last reviewed: 2026-09-21

## Current State

`intuitive-flow` is a portable workflow kit for Claude Code and Codex. The repo
currently provides:

- root human docs, starter agent guidance, and the harness reference ledger in
  `docs/human/agent-harness-references.md`
- reusable installed skills under `skills/`
- a routed `cross-review` skill for bounded second opinions on existing agent
  proposals before heavier planning or preflight
- a default `research` skill for evidence-led investigation across multiple
  sources without adding a dedicated search runtime
- task-routed skill entrypoints with conditional references for test cleanup,
  planning, worktree porting, squash, and issue tracking; short skills stay
  self-contained
- portable durable-run ownership that preserves target-repo status conventions,
  isolates task state, and keeps shared project status single-writer
- an opt-in Flow plan prose gate (STE-flavored shadow check, report-only) with
  summary-only local JSONL trial memory and a seven-day report
- a single default skill install allowlist at
  `scripts/default-skill-allowlist.txt`
- a separate prune-only ledger for retired local artifacts at
  `scripts/default-skill-prune-ledger.txt`
- a default `intuitive-shape` skill with paired decision evals, narrow implicit
  invocation, and explicit Flow routing for unsettled product bets
- shared plan selection that preserves repo conventions and recommends
  `docs/plans/MM-DD-<slug>.md` when none exists
- GSD final verification through normally installed `gsd-verify-work`; missing
  selected wrappers trigger reinstall even at the current upstream version
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

The updater registers the `fetch` MCP server for both Claude Code and Codex
through `npx -y mcp-fetch-server@latest`; it does not clone or maintain a local
fetch-mcp checkout. The server is host-native and must be health-checked in each
client after an update.

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
- keep `intuitive-shape` default routing narrow: use it for unsettled bets and
  scope decisions, not settled tiny fixes, diagnostics, or approved execution
- keep the primary user-facing routes to Shape, Flow, Refactor, Reduce Entropy,
  and Research; route specialist skills on demand
- keep install and prune policy explicit in the two ledgers under `scripts/`
- keep plan-prose checks opt-in and report-only; if the trial report has not
  reached `ADVANCE_TO_CANDIDATE_SHADOW` by 2026-11-30, or returns
  `DROP_OR_RETUNE`, remove the gate and its helper
- choose direct or delegated execution by context, recovery, and parallelism
  needs; hand off concrete proof commands and success conditions
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
- Skill installation is controlled by `scripts/default-skill-allowlist.txt`;
  default and routed entries install normally, optional-install entries require
  explicit selection, and per-skill `agents/openai.yaml` can independently
  require explicit invocation. External entries are host-scoped, and prune-only
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
