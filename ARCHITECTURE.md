# Architecture

`intuitive-flow` is a portable operating kit for AI-agent-developed repos. It
does not own an application runtime. It owns a small set of human docs, reusable
agent skills, and install/update automation for Claude Code, Codex, GSD, gstack,
MCP fetch tooling, and related skill sources.

## System Shape

```text
human docs
  README.md, BELIEFS.md, ARCHITECTURE.md, STATUS.md, docs/human/**
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
and `$intuitive-reduce-entropy`, with `$intuitive-squash` as a handoff utility.
Specialist skills such as `$intuitive-preflight`, `$intuitive-doc`,
`$intuitive-init`, and `$intuitive-tests` remain available for direct or routed
use, but are not the default choice a user must make up front.
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
- `legacy-skill` and `legacy-command` entries identify old local artifacts that
  the updater may prune.
- The manifest check fails if a root skill exists but is not listed, or if the
  manifest lists a missing root skill.

External skill installs are controlled by `scripts/external-skill-sources.txt`.
Each source names a label, an upstream GitHub repo, and either an explicit
`allowlist` of trusted skill names or an intentional `all` install. The updater
reads this manifest before running `npx skills add`, and `bun run check:skills`
validates the manifest shape so external source drift is visible in the normal
proof boundary.

To add a public skill, create `skills/<name>/SKILL.md`, add it to the manifest,
update `README.md` if it belongs in the preferred skill list, and run
`bun run verify`. If the change is based on external agent-harness guidance,
record the source and distilled lesson in
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
- Codex feature and status-line config
- gstack state sync and vendored gstack setup
- external skill source installation from `scripts/external-skill-sources.txt`
- local command and root-skill sync

Task execution is centralized in `scripts/lib/task-runner.sh`. Individual phases
live under `scripts/tasks/`. Updater-only patch hooks live under
`scripts/support/`. TypeScript helpers and their tests live under `scripts/lib/`.
Local workstation utilities that are not part of the updater contract live under
`scripts/dev/`.

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
deprecated `skills-src/` files before commit without making every commit run the
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

That validates repo-owned skill structure and external skill source manifests,
runs TypeScript checking, and runs Bun tests. GitHub Actions mirrors the same proof in
`.github/workflows/verify.yml`, so broken skill manifests, frontmatter, resource
references, or deprecated `skills-src/` files fail CI.

At the moment, the test suite covers the local skill manifest parser, root-skill
manifest checks, direct skill validation, deprecated source rejection, resource
reference checks, external skill source validation, and pruning of
manifest-owned legacy artifacts.

The repo-owned pre-commit hook repeats the skill structure check locally when
`core.hooksPath` points at `.githooks/`.

`scripts/update.sh` is intentionally not part of the default proof command
because it mutates global tool installations and user-level agent config.
