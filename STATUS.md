# Status

Last reviewed: 2026-06-14

## Current State

`intuitive-flow` is a portable workflow kit for Claude Code and Codex. The repo
currently provides:

- root human docs and starter agent guidance
- a human-facing agent harness reference ledger in
  `docs/human/agent-harness-references.md`
- reusable installed skills under `skills/`
- compact runtime skill entrypoints backed by on-demand `references/`,
  `templates/`, and `scripts/`
- a single default skill install allowlist at
  `scripts/default-skill-allowlist.txt`
- update and sync automation under `scripts/`
- repo-owned Git hooks under `.githooks/`
- Bun TypeScript helpers and tests under `scripts/lib/`
- a GitHub Actions verification workflow under `.github/workflows/verify.yml`
- local workstation utilities under `scripts/dev/`
- vendored GSD and gstack tooling under `vendor/`
- generated Claude Code release-note visualizations under `docs/release-notes/`

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
config, including Claude, Codex, skill installs, gstack state, and vendored
gstack setup.

## Active Focus

The current maintenance focus is keeping the repo dogfoodable:

- keep the human docs small and accurate
- keep `docs/human/agent-harness-references.md` as the source ledger for
  external Claude Code, Codex, AGENTS.md, and field-practice lessons before
  turning those lessons into skill rules
- keep the recommended workflow staged: repo/plan entropy, optional
  `gstack-autoplan` unknown-unknown scout for non-trivial plans, grill-batch,
  preflight, then `intuitive-flow` execution
- keep the user-facing skill surface small: flow, refactor, reduce-entropy,
  agent-planning-loop, and squash; route or directly invoke specialists from
  the allowlist as needed, with docs/init/tests/preflight/
  architecture-scanner/worktree-porting/issue tracking/skill-runner utilities
  kept out of the primary choice set
- keep default skill installs listed in `scripts/default-skill-allowlist.txt`
- keep `agent-planning-loop` as the canonical scout-planning root skill and
  `intuitive-planning-loop` as legacy cleanup only
- use `bun run audit:skill-upstreams` to review upstream skill candidates
  outside the allowlist before adding anything new
- keep installed global skill surfaces pruned by owner state: Intuitive root
  skills, managed external sources, GSD wrappers, and GStack wrappers
- edit repo-owned skills directly under `skills/`
- keep `SKILL.md` entrypoints compact and watch size drift through the
  non-failing `check:skills` size budget report
- keep local hooks enabled with `bun run setup:hooks` so skill structure,
  allowlist coverage, and local resource references are checked before commit
- keep CI and local `bun run verify` aligned
- keep Bash as the ShellCheck-gated orchestration layer and Bun TypeScript as
  the structured validation layer
- keep stable updater entrypoints at `scripts/update.sh` and put local helpers
  under `scripts/dev/` or `scripts/support/`
- verify changes with `bun run verify`

There is no active `.planning/` roadmap or GSD phase in this checkout.

## Known Boundaries

- `docs/release-notes/**` is generated or historical context, not current repo
  truth.
- `docs/assets/**` supports rendered docs and should not carry authoritative
  prose by itself.
- `vendor/**`, `node_modules/**`, and `.venv/**` are dependency or local
  environment surfaces, not human docs.
- `scripts/update.sh` is not a harmless test command; it mutates installed tools
  and user config.
- Default skill visibility is controlled by
  `scripts/default-skill-allowlist.txt`; external sources are never installed in
  broad `all` mode by default.
- GSD and GStack setup may create upstream wrappers temporarily, but the updater
  prunes managed wrappers back to the default allowlist.
- `skills/` is the canonical repo-owned skill source; `scripts/update.sh`
  mirrors allowlisted repo-owned skills into installed host surfaces.
- `.githooks/pre-commit` is opt-in per checkout through `bun run setup:hooks`
  because Git does not version local hook configuration.

## Next Maintenance

- Add focused tests when updater behavior changes.
- Update this file when supported commands, install surfaces, or the active
  project focus changes.
- Update `ARCHITECTURE.md` when a new subsystem, public contract, proof boundary,
  or extension point appears.
