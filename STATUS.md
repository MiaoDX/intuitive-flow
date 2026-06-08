# Status

Last reviewed: 2026-06-08

## Current State

`intuitive-flow` is a portable workflow kit for Claude Code and Codex. The repo
currently provides:

- root human docs and starter agent guidance
- a human-facing agent harness reference ledger in
  `docs/human/agent-harness-references.md`
- reusable installed skills under `skills/`
- an external skill source manifest at `scripts/external-skill-sources.txt`
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
- keep the user-facing skill surface small: flow, refactor, reduce-entropy,
  planning-loop, and squash; route or directly invoke specialists from the
  manifest as needed, with docs/init/tests/preflight/worktree-porting/issue
  tracking/skill-runner utilities kept out of the primary choice set
- keep root skills listed in `scripts/local-skill-manifest.txt`
- keep external skill installs explicit in `scripts/external-skill-sources.txt`
- keep installed global skill surfaces pruned by owner state: Intuitive root
  skills, managed external sources, GSD profile installs, and GStack wrappers
- edit repo-owned skills directly under `skills/`
- keep local hooks enabled with `bun run setup:hooks` so skill structure,
  manifest coverage, and local resource references are checked before commit
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
- Full external skill-source installs are intentional only when listed as `all`
  in `scripts/external-skill-sources.txt`; prefer `allowlist` for narrow trust.
- GSD installs default to `GSD_INSTALL_PROFILE=standard`; set `core` or `full`
  only when intentionally changing the visible GSD command surface.
- GStack installs default to `GSTACK_SKILL_SURFACE=standard`; set `full` only
  when intentionally exposing every upstream GStack skill.
- `skills/` is the canonical repo-owned skill source and install surface.
- `.githooks/pre-commit` is opt-in per checkout through `bun run setup:hooks`
  because Git does not version local hook configuration.

## Next Maintenance

- Add focused tests when updater behavior changes.
- Update this file when supported commands, install surfaces, or the active
  project focus changes.
- Update `ARCHITECTURE.md` when a new subsystem, public contract, proof boundary,
  or extension point appears.
