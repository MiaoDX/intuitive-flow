# Status

Last reviewed: 2026-07-20

## Current State

`intuitive-flow` is a portable workflow kit for Claude Code and Codex. The repo
currently provides:

- root human docs and starter agent guidance
- a human-facing agent harness reference ledger in
  `docs/human/agent-harness-references.md`
- reusable installed skills under `skills/`
- compact runtime skill entrypoints backed by on-demand `references/`,
  `templates/`, and `scripts/`
- portable durable-run ownership that preserves target-repo status conventions,
  isolates task state, and keeps shared project status single-writer
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

- keep the human docs small and accurate
- keep `docs/human/agent-harness-references.md` as the source ledger for
  external Claude Code, Codex, AGENTS.md, and field-practice lessons before
  turning those lessons into skill rules
- keep the recommended workflow split by task shape: tiny bounded tasks may go
  directly to `intuitive-flow`; complex or ambiguous work should use preflight,
  invoking plan entropy, planning scouts, or grill-batch only for material
  risks or unresolved decisions, then execute through `intuitive-flow`
- keep the default user-facing surface small: flow, refactor, and
  reduce-entropy; route installed specialists as needed, with docs/init/tests/preflight/
  architecture-scanner/worktree-porting/issue tracking/plan-bakeoff/research/
  skill-runner utilities kept out of the primary choice set, and changed-code
  cleanup owned by `intuitive-refactor`
- keep the managed skill portfolio in `scripts/default-skill-allowlist.txt`
  with parsed default/routed/on-demand tiers and external host scope
- keep retired local artifact cleanup in
  `scripts/default-skill-prune-ledger.txt`, not in the install allowlist
- use the trial community section for promising external skill sets that should
  be dogfooded before they are promoted into flow routes or removed
- keep `gstack-autoplan` and `agent-planning-loop` as risk-triggered routed
  planning tools, not mandatory stages
- use `bun run audit:skill-upstreams` to review upstream skill candidates
  outside the allowlist before adding anything new
- keep installed global skill surfaces pruned by owner state: Intuitive root
  skills, managed external sources, GSD wrappers, and GStack wrappers
- keep `$gstack-investigate` as the default root-cause/debugging route instead
  of adding another overlapping default debugging skill
- keep GSD phase machinery routed by `$intuitive-flow` or explicit GSD use;
  GSD status/resume/pause helpers remain registered on-demand
- edit repo-owned skills directly under `skills/`
- keep cross-skill runtime rules in `skills/_shared/` when Flow and Refactor
  intentionally share behavior; `_shared` is a bundled resource surface, not an
  allowlisted root skill
- keep durable task state target-local: one task control plane owns each
  capsule, workers return evidence, and only an explicit project integrator
  writes an existing shared project-status surface
- keep `SKILL.md` entrypoints compact and watch size drift through the
  non-failing `check:skills` size budget report; `check:skills` also rejects
  skill-style frontmatter in non-entrypoint Markdown so references and templates
  cannot drift as shadow skill manifests
- keep local hooks enabled with `bun run setup:hooks` so skill structure,
  allowlist coverage, and local resource references are checked before commit
- keep CI and local `bun run verify` aligned
- keep Bash as the ShellCheck-gated orchestration layer and Bun TypeScript as
  the structured validation layer
- keep stable updater entrypoints at `scripts/update.sh` and put local helpers
  under `scripts/dev/` or `scripts/support/`
- verify changes with `bun run verify`

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
- `.githooks/pre-commit` is opt-in per checkout through `bun run setup:hooks`
  because Git does not version local hook configuration.

## Next Maintenance

- Add focused tests when updater behavior changes.
- Update this file when supported commands, install surfaces, or the active
  project focus changes.
- Update `ARCHITECTURE.md` when a new subsystem, public contract, proof boundary,
  or extension point appears.
