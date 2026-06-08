# Architecture

`intuitive-flow` is a portable operating kit for AI-agent-developed repos. It
does not own an application runtime. It owns a small set of human docs, reusable
agent skills, and install/update automation for Claude Code, Codex, GSD, gstack,
MCP fetch tooling, and related skill sources.

## System Shape

```text
human docs
  README.md, ARCHITECTURE.md, STATUS.md, docs/human/**
  supporting doctrine: BELIEFS.md
        |
        v
agent guidance
  AGENTS.md, CLAUDE.md
        |
        v
reusable workflows
  skills/*/SKILL.md + optional skills/*/{references,templates,scripts}
        |
        v
install and sync pipeline
  scripts/update.sh -> scripts/tasks/* + scripts/support/* -> scripts/lib/*
        |
        v
local/global agent surfaces
  ~/.claude, ~/.codex, ~/.agents, ~/.gstack, vendor/gstack

local git hooks
  .githooks/pre-commit -> scripts/dev/pre-commit.sh
```

The root docs define what the project is. Agent guidance files define how
Claude Code and Codex should operate inside a repo. `skills/` is the canonical
repo-owned skill source and install surface, and scripts install and sync those
workflows into local agent tooling.

## Human Documentation Contract

The current human-facing source of truth is intentionally small:

- `README.md` gives orientation, install commands, and the public project map.
- `ARCHITECTURE.md` names subsystems, contracts, extension points, and proof
  boundaries.
- `STATUS.md` records current state, supported commands, and active maintenance
  focus.
- `docs/human/**` holds human-facing detail that should not bloat the root docs.
  `docs/human/agent-harness-references.md` is the durable reference ledger for
  external Claude Code, Codex, AGENTS.md, and field-practice lessons that shape
  this repo's harness.

Everything else is lower tier by default. `docs/assets/**` supports root docs,
`docs/release-notes/**` is generated or historical analysis, `vendor/**` is
external tooling, and planning or execution artifacts are evidence unless a
human doc promotes them.

`BELIEFS.md` is supporting doctrine: it explains the philosophy behind the
workflow, but it is not the active source for current commands, installed
surfaces, or maintenance state.

## Agent Guidance Contract

`AGENTS.md` and `CLAUDE.md` are starter guidance for this repo and examples for
target repos. They should remain self-contained enough for their host agents to
act without chasing a long manual.

Target repos should not inherit these files wholesale. `$intuitive-init`
combines local repo evidence, any available `/init` output, and Intuitive Flow
defaults into project-local `AGENTS.md` and `CLAUDE.md` files.

## Skill Contract

Each reusable workflow installs from `skills/<name>/SKILL.md`. A skill should
describe when it activates, how it should run, and what output or side effects
are expected.

The primary user-facing skills are `$intuitive-flow`, `$intuitive-refactor`,
`$intuitive-reduce-entropy`, `$intuitive-planning-loop`, and
`$intuitive-squash`. Specialist skills such as `$intuitive-preflight`,
`$intuitive-doc`, `$intuitive-init`, and `$intuitive-tests` remain available for
direct or routed use, but are not the default choice a user must make up front.
`$intuitive-preflight` owns approval-ready preflight contracts before a plan or
vague task starts: context package, scope, non-goals, definition of done,
verification, route, worker strategy, and main-session `/goal` wording. Open-ended architecture
discovery may route to the external `improve-codebase-architecture` skill when
it is installed; accepted cleanup still returns to `$intuitive-refactor` for
the scope gate and execution.

Repo-owned skills are authored directly under `skills/<name>/SKILL.md`. Large
skills should use progressive disclosure instead of generated includes:

```text
skills/<name>/
  SKILL.md
  references/*.md
  templates/*.md
  scripts/*
```

`SKILL.md` should remain the compact entrypoint: trigger, route, invariants, and
which local reference to read next. Conditional detail belongs in one-level
`references/` files, deterministic mechanics in `scripts/`, and reusable output
shapes in `templates/`.

This source layout is intentionally separate from host install and discovery
layouts. `skills/` is the repo-owned source of truth; the sync pipeline projects
those skills into Claude Code, Codex, MiMoCode, and shared agent install
surfaces. Do not change the repo source tree solely because a host discovers
skills under `.claude/skills`, `.codex/skills`, or `.agents/skills`.

The install surface is controlled by `scripts/local-skill-manifest.txt`:

- `root-skill` entries are repo-owned skills that should be installed or synced.
- `legacy-skill` entries identify old repo-owned skill installs and their
  generated MiMoCode command wrappers that the updater may prune.
- `legacy-command` and `legacy-mimocode-command` entries identify old standalone
  command files that the updater may prune.
- The manifest check fails if a root skill exists but is not listed, or if the
  manifest lists a missing root skill.

During `scripts/update.sh`, the local sync writes
`~/.intuitive-flow/owned-root-skills.json` after a successful root-skill sync.
On later runs, it removes only skill directories that were previously recorded
as Intuitive-owned but are no longer listed as `root-skill`. If the ownership
state does not exist yet, the updater seeds it after sync and does not infer
ownership from matching names. User-installed skills outside that owned state
are preserved.

External skill installs are controlled by `scripts/external-skill-sources.txt`.
Each source names a label, an upstream GitHub repo, and either an explicit
`allowlist` of trusted skill names or an intentional `all` install. The updater
reads this manifest before running `npx skills add`, and `bun run check:skills`
validates the manifest shape so external source drift is visible in the normal
proof boundary. Matt Pocock skills are intentionally allowlisted to the small
debugging, TDD, handoff, and planning-discussion surface that Intuitive still
routes to; deprecated, in-progress, setup, writing, and issue-workflow skills
are not installed by default.

External source cleanup uses the same ownership rule. After each successful
external install, the updater writes
`~/.intuitive-flow/external-skills-<label>.json`. Later runs remove only skills
that were previously recorded for that label but are no longer desired. For
`allowlist` sources, desired skills come from `scripts/external-skill-sources.txt`;
for intentional `all` sources, desired skills come from `.agents/.skill-lock.json`
entries for that exact upstream source. If the lock has no source evidence, the
cleanup fails closed and preserves the previous state.

GSD installs default to `GSD_INSTALL_PROFILE=standard`, not upstream `full`.
The wrapper passes `--profile=$GSD_INSTALL_PROFILE` and treats a profile drift as
requiring reinstall even when the installed GSD version is current. Set
`GSD_INSTALL_PROFILE=core` for the smallest project-loop surface or `full` for
the complete command set.

GStack installation is upstream-owned but wrapped by this updater. After a
successful GStack setup, the wrapper records generated Codex `gstack-*` skills in
`~/.intuitive-flow/gstack-codex-skills.json` and Claude short-name wrappers in
`~/.intuitive-flow/gstack-claude-skills.json`. The default
`GSTACK_SKILL_SURFACE=standard` keeps the common browser, QA, review,
plan-engineering review, ship, health, investigate, guard, scrape, and spec
entrypoints. It prunes only stale symlinks or `SKILL.md` wrappers that point
into the managed GStack checkout. Set `GSTACK_SKILL_SURFACE=full` to expose
every upstream GStack skill. It does not infer ownership from plain directory
names or delete unrelated user skills.

To add a public skill, create `skills/<name>/SKILL.md`, add it to the manifest,
update the live human docs that describe the public surface, refresh any
current skill audit that claims manifest-wide coverage, and run `bun run
verify`. If the change is based on external agent-harness guidance, record the
source and distilled lesson in
`docs/human/agent-harness-references.md` before spreading the rule into skills.

## Update Pipeline Contract

`scripts/update.sh` is the orchestration entrypoint. Bash owns process control,
environment checks, task ordering, and parallel execution. Bun-run TypeScript
owns structured parsing, validation, and config rewrites where shell string
handling would be brittle.

The updater currently handles these phases:

- environment and running-Codex prechecks
- global CLI installation for Claude Code, Codex, fetch setup, and Pyright
- GSD installation for Claude and Codex
- MCP fetch setup
- Claude plugin installation
- Codex feature, status-line config, and merged hook config
- gstack state sync and vendored gstack setup
- external skill source installation from `scripts/external-skill-sources.txt`
- local command and root-skill sync

Task execution is centralized in `scripts/lib/task-runner.sh`. Individual phases
live under `scripts/tasks/`. Updater-only patch hooks live under
`scripts/support/`. TypeScript helpers and their tests live under `scripts/lib/`.
Local workstation utilities that are not part of the updater contract live under
`scripts/dev/`.

Codex hook writers must merge into `~/.codex/hooks.json` instead of replacing
the file. `scripts/dev/tmux-richer.sh` uses `scripts/lib/ensure-codex-hooks.ts`
to add tmux-agent-status lifecycle hooks while preserving other hook owners such
as Agent Deck notify hooks.

To add a new update phase, implement the phase in `scripts/tasks/`, source it
from `scripts/update.sh`, schedule it with the task runner, and document any new
external state or environment variables in the human docs.

## Local Git Hook Contract

Repo-owned Git hooks live under `.githooks/` and are enabled per checkout with:

```bash
bun run setup:hooks
```

The pre-commit hook delegates to `scripts/dev/pre-commit.sh` and runs
`bun run check:skills`. This catches missing manifest entries, stale generated
include syntax, invalid frontmatter, broken local skill resource references, and
GitHub Actions Bun pin drift before commit without making every commit run the
full TypeScript and test proof.

## Codex Adapter Contract

Claude Code slash commands and Codex skills have different shapes. When this
repo has `.claude/commands/*.md`, `scripts/lib/codex-skill-adapter.sh` can render
those command files as Codex skill directories with an adapter block.

The adapter contract translates:

- Claude `AskUserQuestion` prompts into Codex `request_user_input` calls when
  available.
- Claude `Task(...)` calls into Codex `spawn_agent` calls.
- Claude command arguments into skill invocation arguments.

Root skills under `skills/` are copied directly into `~/.codex/skills/` and
installed for Claude Code through the skills CLI.

## Proof Boundary

The basic local proof command is:

```bash
bun run verify
```

That validates repo-owned skill structure, external skill source manifests,
local skill resource references, and Bun toolchain pin alignment, runs
ShellCheck error-level checks for Bash orchestration scripts, runs TypeScript
checking, and runs Bun tests. GitHub Actions mirrors the same proof in
`.github/workflows/verify.yml`, so broken skill manifests, frontmatter, resource
references, deprecated `skills-src/` files, or CI/local Bun version drift fail
CI.

At the moment, the test suite covers the local skill manifest parser, root-skill
manifest checks, direct skill validation, deprecated source rejection, resource
reference checks, external skill source validation, GitHub Actions Bun pin
alignment, and pruning of
manifest-owned legacy artifacts, stale previously owned root skills, stale
managed external skills, stale managed GStack skill links, default GStack
surface pruning, and installer wrapper calls that enforce managed state.

The repo-owned pre-commit hook repeats the skill structure check locally when
`core.hooksPath` points at `.githooks/`.

`scripts/update.sh` is intentionally not part of the default proof command
because it mutates global tool installations and user-level agent config.
