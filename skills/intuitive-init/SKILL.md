---
name: intuitive-init
description: Initialize, audit, aggressively slim, merge, and refresh project-local AGENTS.md and CLAUDE.md files from existing repo guidance, agent /init suggestions, stdin-bundled Codex init-style discovery, and intuitive workflow defaults, including target-repo LSP and agent-facing Serena MCP setup. Use when setting up a repo for Claude Code/Codex, replacing symlinked agent files with local guidance, rerunning agent init after weeks of drift, cleaning overgrown root agent files, or aligning a repo to intuitive-doc, intuitive-tests, intuitive-flow, intuitive-refactor, and intuitive-reduce-entropy without overwriting project-specific hints. When the user asks to "setup LSP" for a coding-agent repo, treat Serena MCP as the preferred agent-facing LSP path unless it is already configured or concretely blocked.
---

# Intuitive Init

Set up repo-local AI agent guidance without turning shared defaults into a
symlinked source of truth. Shared skills should travel across projects;
`AGENTS.md` and `CLAUDE.md` should preserve the local repo's commands,
constraints, workflow choices, and hard-won mistakes.

In Claude Code and Codex work, a repo harness is the infrastructure that lets an
agent enter an existing project without guessing: root and nested instruction
files, reusable skills, hooks, MCP configuration, target-repo LSP setup, and
local verification commands. `$intuitive-init` builds or refreshes that harness
from repo evidence, official tool guidance, and init-style suggestions.

Default posture: keep root agent files aggressively small. Correct but lengthy
procedures should usually move out of `AGENTS.md` and `CLAUDE.md` into
`docs/agents/**`, reusable skills, or scripts, with the root files keeping only
the rule, trigger, and pointer.

Use these size signals:

- Target: each root agent file is short enough to skim before work starts,
  usually under 120 lines.
- Warning: over 180 lines means audit should report bloat and propose deletes or
  extraction.
- Strong cleanup signal: over 250 lines, duplicated sections between
  `AGENTS.md` and `CLAUDE.md`, or long numbered procedures in root files.

These are signals, not hard limits. Keep a longer root file only when the
content is a critical safety rule that agents must see before any other read.

## Official Reference Sources

Prefer current official docs when refreshing a repo harness:

- Claude Code best practices:
  `https://code.claude.com/docs/en/best-practices`
- Claude Code memory and `CLAUDE.md` loading:
  `https://code.claude.com/docs/en/memory`
- Claude Code docs map:
  `https://code.claude.com/docs/en/claude_code_docs_map`
- Claude blog guide for `CLAUDE.md`:
  `https://claude.com/blog/using-claude-md-files`
- Codex best practices:
  `https://developers.openai.com/codex/learn/best-practices`
- Codex `AGENTS.md` guide:
  `https://developers.openai.com/codex/guides/agents-md`
- Codex advanced configuration:
  `https://developers.openai.com/codex/config-advanced`
- Open `AGENTS.md` format:
  `https://agents.md/`

Use those sources as references, not as replacement text. Local repo evidence
still wins when the docs and the actual project disagree.

## Human/Agent Surface Rule

The default human-facing source of truth is intentionally small:

- `README.md`
- `ARCHITECTURE.md`
- `STATUS.md`
- `docs/human/**`

`AGENTS.md` and `CLAUDE.md` are agent-operational docs. Use them for startup
rules, local hazards, command pointers, and skill routing, but do not treat them
as human-authoritative project truth by default.

Agent planning, generated evidence, history, and working notes belong in
explicit agent/process surfaces such as `.planning/**`, `docs/plans/**`,
`docs/retrospectives/**`, `docs/status/active/**`, and `output/**` unless a
human doc intentionally promotes a specific artifact into current truth.

AI coding docs are agent/process-facing docs that help future coding agents but
do not need to be human project truth. Prefer `docs/agents/**` for durable
agent runbooks, repo-specific coding procedures, tool quirks, and long harness
notes. Prefer `.planning/**`, `docs/plans/**`, `docs/retrospectives/**`,
`docs/status/active/**`, and `output/**` for execution state, plans,
retrospectives, generated evidence, and proof artifacts.

Agent files may point to human-authoritative docs and say how agents should
react when those docs conflict with a request. Do not copy milestone goals,
non-goals, steering policy, documentation taxonomy, or other human-facing
project state into agent files. Those copied blocks drift after `$intuitive-doc`
cleans or reorganizes the human surface.

## Agent Reference File Boundary

Use `docs/agents/**` for repo-specific agent reference material that is too long
for the root files but still useful to coding agents.

Good candidates for `docs/agents/**`:

- release procedures
- CI failure investigation runbooks
- dependency/bootstrap playbooks
- GPU, simulator, cloud, or hardware setup notes
- PR review/fix workflows
- model/tool-specific caveats
- long examples and copy/paste command checklists

Prefer a reusable skill when the procedure applies across repos. Prefer a
script, Makefile target, or just recipe when the procedure is mostly commands.
Prefer human docs when the information is project truth for humans, not agent
operation.

Root `AGENTS.md` and `CLAUDE.md` should contain only:

- the first docs to read
- critical local hazards and permissions
- canonical install/test/verify commands or the pointer to them
- source-of-truth boundaries
- short skill routing
- pointers to longer `docs/agents/**` runbooks when needed

## Compatibility Posture

Prefer live-at-HEAD behavior and forward migration over backward compatibility
by default. Treat `legacy`, `compatibility`, old command aliases, stale
transitional docs, and preserved historical surfaces as cleanup signals, not as
things to keep automatically.

When the change is scoped, remove or replace obsolete paths and update their
tests/docs in the same pass. If removing compatibility would touch a broad
command surface, install/update behavior, generated outputs, public docs, or
many files, stop after a proposal and ask the user to confirm the removal plan.

Use a practical WHY / WHAT / HOW shape for the root files:

- WHY: the project purpose and why the main modules exist
- WHAT: the tech stack, package layout, and important directory map
- HOW: install, build, test, verification, and safe change workflow

Keep lint and format policy out of root guidance unless there is a local hazard
agents cannot infer. Put deterministic enforcement in formatter/linter config,
scripts, CI, or hooks, and point agents to the command or hook instead.

For large repos, prefer nested `CLAUDE.md` and `AGENTS.md` files near specialized
areas such as `src/api/`, `services/payments/`, or individual packages. The
root file should explain the layering rule and the local override convention,
not carry every package's full procedure.

When MCP servers are part of the team workflow, prefer a checked-in `.mcp.json`
or equivalent project-scoped config so new clones get the same tool wiring.
Never put secrets in committed MCP config; point to environment variables or
local setup docs for credentials.

## Target-Repo LSP Setup

Set up language server support as part of repo harness initialization, not as a
separate optional cleanup. Agents refactor and navigate more safely when
definition, reference, rename, diagnostics, and hover signals work for the
project's real language stack.

Default action in Apply, Refresh, and Symlink Migration modes: detect the
target repo's primary languages and configure a two-layer LSP setup
automatically when the setup is recognized, repo-local, and safe to apply:

1. A repo-local language-server config that makes the underlying language
   server accurate for editors, CI, and MCP servers.
2. An agent-facing MCP LSP surface, preferably Serena, so Claude/Codex can use
   symbol search, references, rename, outline, hover, and diagnostics directly.

Do not treat a working Pyright, TypeScript, Rust, Go, or other repo-local
language-server config as complete agent-facing LSP setup by itself. It is the
foundation that makes Serena accurate, not a substitute for MCP symbol tools.

Use repo evidence before choosing an LSP path:

- JavaScript/TypeScript: `package.json`, lockfiles, `tsconfig*.json`, framework
  config, existing `typescript` or language-server dev dependencies.
- Python: `pyproject.toml`, `uv.lock`, `.python-version`, `.venv`, `pyright` or
  `basedpyright` config, and the repo's `uv` conventions.
- Rust, Go, Java, Ruby, PHP, C/C++, and other stacks: their canonical manifests,
  lockfiles, toolchain files, and existing editor or agent config.
- Existing agent/editor surfaces: `.claude/settings.json`, `.mcp.json`,
  `.vscode/settings.json`, `docs/agents/**`, setup scripts, CI checks, any
  checked-in language-server config, and any MCP-based LSP entries already
  wired into the host CLI (for example a `serena` entry in `.mcp.json`,
  `~/.claude.json` MCP servers, `~/.codex/config.toml` `[mcp_servers.*]`
  blocks, or a `.serena/` project directory).

Prefer checked-in repo-local setup over relying on a global tool that only one
machine has. Good underlying language-server setup usually means one or more of:

- the language server or required compiler package is declared as a dev
  dependency in the repo's normal package manager
- the project has the config file the server needs to find source roots,
  virtualenvs, workspaces, generated types, or strictness settings
- the setup command is included in the repo's install/bootstrap path
- agent guidance points to the setup only as a short command, not a long manual

For Python repos, prefer `uv` and the project's `.venv` conventions. Do not add
Python dependencies through the system interpreter.

If the project already gets underlying language-server setup through a team
updater, plugin, devcontainer, Nix shell, or toolchain manager, verify that path
and record it instead of adding a competing local setup. Still evaluate whether
the coding agent itself has Serena or an equivalent MCP symbol surface; editor
LSP alone does not satisfy that requirement.

Stop and report instead of editing when LSP setup would require a paid service,
local-only hardware, broad package-manager migration, heavy toolchain install,
or uncertain global state. In that case, add the missing setup to the proposal
or `docs/agents/**` runbook with the exact command the user should approve.

### MCP-Based LSP Path

Serena MCP is the preferred default for agent-facing LSP setup. A repo-local
language-server config is still required, especially for Python virtualenvs and
monorepo source roots, but it should normally be paired with Serena so
symbol-level operations reach the coding agent itself, not just the editor or
CI. The current reference implementation is
[Serena](https://github.com/oraios/serena): one MCP server that exposes symbol
search, references, rename, document outline, hover, and diagnostics across
Python, TypeScript, Rust, Go, and other stacks through their existing language
servers.

In Apply and Refresh modes, after verifying or creating the repo-local
language-server config, set up Serena MCP or explicitly propose the exact Serena
setup path unless one of the stop conditions applies.

Prefer Serena MCP by default, and especially when one or more of these is true:

- the repo spans several languages and a single agent-facing surface is
  cheaper than wiring one LSP plugin per language
- the team uses both Claude Code and Codex and wants the same symbol tooling
  in both (Serena ships a Codex-specific `--context codex` mode)
- the host CLI's native LSP plugin path is unavailable, broken, or noisier
  than a checked-in MCP entry
- the agent needs symbol-level operations during long-running edits where
  text search alone causes regressions

Use a repo-local language-server-only path only when:

- the project already has a working Serena or equivalent MCP symbol server
- the host CLI cannot use MCP servers in the current environment
- the Serena install or activation path is uncertain after checking current
  upstream docs
- adding or activating Serena would require global secrets, a paid service,
  local-only hardware, broad toolchain migration, or user approval that has not
  been granted

The two paths can coexist: a checked-in language-server config keeps the
editor and CI honest, while an MCP entry gives the agent symbol tools during
its own runs.

Operational guidance for the MCP path, intentionally minimal so the agent
checks current upstream docs before editing config:

- Treat the upstream README and recent release notes as the source of truth
  for install, transport, and per-host context flags. Do not paste old
  commands from memory.
- Add the MCP server through the host CLI's native command when one exists
  (for example `claude mcp add` or `codex mcp add`) or through a checked-in
  `.mcp.json` / `~/.codex/config.toml` block. Pin the install method the
  upstream README currently recommends.
- Activate the server for the current repo and confirm the agent can see its
  tools before declaring setup done. Record the activation step in
  `docs/agents/**` or root guidance only when the host does not auto-activate
  on session start.
- For Python repos, still keep a `pyrightconfig.json` or `[tool.pyright]`
  block with `venvPath` and `venv` set. MCP-based LSP servers reuse the
  underlying language server, so missing project config still produces
  false `reportMissingImports` diagnostics.
- Stop and report instead of editing when the MCP install would require
  global secrets, paid services, or an install path the user has not
  approved.

## Core Rule

Treat generated init output and Intuitive Flow defaults as reviewers, not
authority.

Authoritative inputs, in order:

1. System/developer/user instructions for the current session.
2. Existing project-local `AGENTS.md` and `CLAUDE.md`.
3. Root orientation docs such as `README.md`, `ARCHITECTURE.md`, `STATUS.md`,
   `docs/agents/**`, and command docs.
4. Actual repo commands, scripts, package metadata, CI config, and tests.
5. Agent `/init`, `codex init` when available, or stdin-bundled init-style
   discovery from a read-only Codex run.
6. Intuitive Flow defaults and skill-routing conventions.

`/init`, `codex init` when the installed Codex interface exposes it, and
similar generated discovery are starting points, not finished harnesses. Expect
them to find package manifests, build systems, tests, and obvious directory
structure; then prune generic output, add local hazards, and move repeated or
lengthy work into the right harness surface.

## Default Workflow

Use this workflow unless the user asks for report-only or a specific file.

1. Read the repo orientation surface:
   - `README.md`
   - `ARCHITECTURE.md` and `STATUS.md` when present
   - existing `AGENTS.md` and `CLAUDE.md`
   - nearby agent docs such as `docs/agents/**` when present
2. Inspect the files, commands, and config that make guidance testable:
   - package metadata
   - `justfile`, `Makefile`, scripts, CI workflows, test config
   - language manifests, lockfiles, compiler config, virtualenv/toolchain files,
     and existing language-server config
   - skill folders or command folders
3. Use init-style discovery when it is available and worth the extra evidence:
   - Prefer `/init`, `codex init` when available, or the tool's equivalent in
     suggestion/refactor mode.
   - If `/init` refuses because `AGENTS.md` or `CLAUDE.md` already exists,
     prompt it to "help refactor the current file" rather than overwrite.
   - Capture useful suggestions only. Do not treat init output as final text.
   - If native slash commands are not exposed, either continue from repo
     evidence or use the stdin-bundled Codex CLI discovery below when the host
     supports it. Missing nested-agent support is not a blocker.
4. Classify current guidance:
   - **Preserve**: project commands, env setup, permissions, local hazards,
     workflow source-of-truth rules, domain vocabulary, test gates.
   - **Merge**: concise shared behavior that still fits this repo.
   - **Replace**: stale setup steps, symlink-first instructions for root agent
     files, generic advice duplicated by system behavior.
   - **Extract**: correct but lengthy procedures that belong in
     `docs/agents/**`, a reusable skill, or a script instead of root guidance.
   - **Collapse**: verbose but necessary root guidance that can become one rule
     plus a pointer.
   - **Remove**: obsolete commands, absolute paths from another project,
     generic best practices, duplicated Claude/Codex sections, copied human
     project state, process notes that belong in skills instead of root
     guidance, or compatibility shims that are no longer the live path.
5. Add or refresh a short preferred-skills block when relevant:
   - `$intuitive-init` for agent guidance initialization and periodic refresh.
   - `$intuitive-doc` for human-facing docs and doc drift.
   - `$intuitive-tests` for test-suite structure and behavior-focused cleanup.
   - `$intuitive-flow` as the default build/change entrypoint that routes by
     scope.
   - `$intuitive-preflight` before plan or vague-task execution when approval
     should cover context package, scope, definition of done, verification,
     route, and main-session `/goal` wording.
   - `$intuitive-refactor` before broad architecture or refactor work.
   - `$intuitive-reduce-entropy` for periodic repo maintenance when the user
     does not already know which surface needs cleanup.
   - `$intuitive-squash` for cleaning local agent commit history before handoff.
   Keep this block as routing guidance only. Do not use it to define the human
   documentation surface; `$intuitive-doc` owns that split.
6. Check harness-specific surfaces:
   - nested `CLAUDE.md` / `AGENTS.md` files for monorepos or package-local rules
   - `.claude/skills/**`, `.codex/skills/**`, `.agents/skills/**`, or
     project-owned `skills/**` for repeated workflows
   - `.claude/settings.json`, `.codex/hooks/**`, or equivalent hook config for
     deterministic checks that must run after edits
   - checked-in `.mcp.json` or project-scoped MCP docs for shared external tools
7. Set up or verify target-repo LSP:
   - Detect the repo's primary language stack from manifests and lockfiles.
   - Verify or create the repo-local language-server config first.
   - Then verify, configure, or propose Serena MCP as the agent-facing symbol
     tool unless it is already covered or concretely blocked.
   - Prefer repo-local dev dependencies and checked-in config over global-only
     tools, but do not let editor-only LSP config replace agent-facing MCP.
   - Apply the setup automatically when it is recognized and scoped to the
     target repo.
   - If LSP is already configured, verify and summarize both the underlying
     language-server path and the agent-facing MCP path.
   - If setup is unsafe or ambiguous, stop with a concrete proposal and command
     instead of guessing.
8. Produce a merged proposal first:
   - Summarize the source inputs used.
   - Report root file sizes and whether cleanup pressure is low, medium, or
     high.
   - Explain what was preserved, collapsed, extracted, replaced, and removed.
   - Name any new `docs/agents/**`, skill, script, or human-doc destination for
     extracted content.
   - Call out any nested instruction files, hooks, skills, or MCP config that
     should be created, left alone, or moved out of the root files.
   - Call out the target-repo LSP status separately for:
     underlying language-server config and agent-facing Serena/MCP setup.
     Mark Serena/MCP as configured, refreshed, already covered, skipped with a
     concrete blocker, or needing user approval.
   - Show the diff or proposed file contents.
9. Apply changes only when the user has asked for direct implementation or
   approves the proposal. When applying, update both `AGENTS.md` and
   `CLAUDE.md` if both exist and the rule applies to both agents. Also apply
   recognized repo-local LSP setup changes in the same pass when they are safe
   and scoped to the target repo.

## Agent-Init Discovery

Use init-style discovery as an optional reviewer, not as the source of truth.
The durable requirement is that repo evidence wins and generated suggestions are
merged deliberately. Skip discovery when the host cannot run it cheaply or
reliably.

### Native slash command

Use this when the host exposes `/init`, `codex init`, or an equivalent tool.
Some Codex CLI builds may not expose `codex init`; in that case, skip directly
to the stdin-bundled Codex CLI discovery fallback.

```text
/init
```

```text
codex init
```

If root agent files already exist, ask for suggestion/refactor mode rather than
overwrite mode:

```text
Help refactor the current AGENTS.md and CLAUDE.md. Produce suggestions only;
do not overwrite files.
```

### Default Codex CLI discovery

Use this when a second-opinion review is useful, native `/init` is not exposed,
and the `codex` CLI is installed. This is not a file-editing pass. It should
only produce suggestions to merge into the proposal. Build a context bundle
with the host tools and pipe it into Codex so Codex does not need to run nested
read commands through its own sandbox.

Use this as an adaptable example from the repository root. Equivalent
read-only evidence is acceptable when the host CLI, sandbox, or flags differ:

```bash
{
  printf '# AGENTS.md\n'
  sed -n '1,260p' AGENTS.md 2>/dev/null || true
  printf '\n# CLAUDE.md\n'
  sed -n '1,260p' CLAUDE.md 2>/dev/null || true
  printf '\n# pyproject.toml selected sections\n'
  awk '
    /^\[project.optional-dependencies\]/ {p=1}
    /^\[tool.pytest.ini_options\]/ {p=1}
    /^\[tool.coverage.run\]/ {p=1}
    /^\[/ && !/^\[project.optional-dependencies\]/ && !/^\[tool.pytest.ini_options\]/ && !/^\[tool.coverage.run\]/ {if (p) p=0}
    p {print}
  ' pyproject.toml 2>/dev/null || true
  printf '\n# Orientation and automation files present\n'
  rg --files -g 'README.md' -g 'ARCHITECTURE.md' -g 'STATUS.md' -g 'Makefile' -g 'justfile' -g '.github/workflows/*.yml' -g '.github/workflows/*.yaml' -g 'docs/agents/**' 2>/dev/null | sort || true
} | codex --ask-for-approval never exec --ephemeral --skip-git-repo-check --sandbox read-only -C "$PWD" \
  "Act like Codex /init in suggestion-only mode for this repository. Analyze only the context bundle provided on stdin; do not run shell commands and do not edit files. Prefer aggressively small root agent files. Return: source inputs inspected, root file bloat signals, project-specific guidance to preserve, correct-but-lengthy guidance to extract into docs/agents/** or skills/scripts, stale or duplicated guidance to remove, missing operational rules, and concise suggested edits for AGENTS.md and CLAUDE.md."
```

If the host does not support `--ephemeral`, remove that flag.

### Optional direct Codex read

Only use this when the environment is known to support Codex's nested read-only
sandbox. It may fail on ordinary hosts that restrict bubblewrap user or network
namespaces.

```bash
codex --ask-for-approval never exec --ephemeral --skip-git-repo-check --sandbox read-only -C "$PWD" \
  "Act like Codex /init in suggestion-only mode for this repository. Read the local orientation, agent, package, test, and CI files. Do not edit files. Prefer aggressively small root agent files. Return: source inputs inspected, root file bloat signals, project-specific guidance to preserve, correct-but-lengthy guidance to extract into docs/agents/** or skills/scripts, stale or duplicated guidance to remove, missing operational rules, and concise suggested edits for AGENTS.md and CLAUDE.md. Do not propose a full replacement unless the current files are unusable or overgrown enough that a thin-root rebuild is safer than patching."
```

Treat the output as advisory. If it conflicts with repo evidence, preserve the
repo evidence and mention the disagreement in the proposal.

If `codex` is missing, exits non-zero, or the environment cannot run external
agents, say so briefly and continue from repo evidence.

## Modes

### Audit

Use when the user asks what should change, or when broad edits would be risky.

Report:

```text
Agent files:
Init discovery:
Root file size / cleanup pressure:
Project-specific guidance to preserve:
Correct but lengthy guidance to extract:
Shared boilerplate to remove:
Missing preferred-skill routing:
Harness surfaces to add or leave alone:
Suggested edits:
Apply now? <yes/no needed unless already authorized>
```

Audit must name deletion and extraction candidates. Do not stop at "preserve"
just because a section is true. If the section is true but too long for root
guidance, classify it as Extract or Collapse.

### Apply

Use when the user explicitly asks to update the repo guidance.

Steps:

1. Run the default workflow.
2. Edit only `AGENTS.md`, `CLAUDE.md`, recognized target-repo LSP config or
   dev-dependency files, and directly related init docs/scripts the user named.
3. Keep the files self-contained for critical startup rules, but allow pointers
   to `docs/agents/**` for long operational procedures.
4. Create or update `docs/agents/**` only for extracted agent runbooks that are
   too long for the root files and are not human-facing project truth.
5. Preserve differences between Claude and Codex when they matter.
6. Keep hooks, MCP config, skills, and nested instruction files as separate
   harness surfaces instead of pasting their full procedures into root guidance.
7. Verify or document target-repo LSP setup for the primary language stack.
8. Search for stale setup/init claims after editing.

### Refresh

Use after several weeks, major command changes, a new subsystem, repeated agent
mistakes, or a changed planning workflow.

Run the same workflow as Apply, but be stricter about removing stale commands
and softer about adding new process. A refresh should reduce drift, not expand
root guidance into a manual.

Also use Refresh after `$intuitive-doc` has created, moved, or clarified the
human documentation surface. In that case, update agent files to point at the
final surface and remove copied project strategy, milestone state, or doc-tier
policy that now belongs in human docs.

Refresh is allowed and expected to delete root guidance that is obsolete,
duplicated, generic, copied from human docs, or correct-but-better-extracted.
When the root files are over the strong cleanup signal, prefer a thin-root
rewrite over a patchwork edit: rebuild `AGENTS.md` and `CLAUDE.md` from the
preserve list, then move long runbooks into `docs/agents/**`.

### Slim / Cleanup

Use when the user says the root agent files are too long, asks for aggressive
cleanup, asks to make them "as clean as possible", or when audit finds strong
cleanup signals.

Default result:

- `AGENTS.md`: repo-wide rules all agents must see immediately.
- `CLAUDE.md`: Claude-specific deltas only, not a full duplicate of
  `AGENTS.md`.
- `docs/agents/README.md`: index of longer agent-only runbooks when any exist.
- `docs/agents/<topic>.md`: extracted procedures for release, CI triage,
  environment setup, GPU/simulator setup, PR workflows, or similar long tasks.

Steps:

1. Build a preserve list from actual repo evidence.
2. Mark each current root section as Preserve, Collapse, Extract, Remove, or
   Human-doc drift.
3. Draft the thin root files first using the WHY / WHAT / HOW shape when it
   helps agents orient quickly.
4. Move lint/format details, long command recipes, and repeatable operational
   loops to hooks, scripts, skills, or `docs/agents/**` as appropriate.
5. Draft extracted `docs/agents/**` runbooks only for procedures that remain
   useful.
6. Verify root files contain pointers to extracted runbooks and no long copied
   procedures.
7. Show the deletion/extraction diff unless the user already approved applying.

### Symlink Migration

Use when `AGENTS.md` or `CLAUDE.md` is a symlink to a shared toolkit.

Preferred result:

- Convert the symlink into a project-local regular file.
- Preserve the current linked content as the starting point.
- Merge in project-specific hints from repo evidence and init suggestions.
- Keep reusable workflows in skills, not pasted into the root files.

Do not silently overwrite local agent files with shared templates. If a legacy
bootstrap script is in scope, make it defer to this AI-native merge flow or
remove it from the recommended path.

## Merge Rules

Good root agent guidance is short, local, and operational:

- what to read first
- how to install and run this repo
- which tests and verification gates matter
- what workflows own planning/execution truth
- which local network, API, hardware, or sandbox constraints matter
- which custom skills to use for recurring work

Deletion is part of the job. Remove or extract content even when it is accurate
if it makes the root files hard to scan and can be represented by a short rule
plus a pointer.

Do not duplicate the same long section in both `AGENTS.md` and `CLAUDE.md`.
Common repo-wide guidance belongs in `AGENTS.md` or `docs/agents/**`; Claude-only
behavior belongs in `CLAUDE.md`.

Use stable operational bridges instead of policy copies. Prefer wording like
"Before broad work, read the active status or steering doc when present; if it
conflicts with the request, ask the user" over repo-specific sections that
duplicate the current milestone, non-goals, review gates, or documentation
taxonomy.

Move reusable procedures into skills instead of expanding root guidance.
Examples: documentation audits, test suite cleanup, repo entropy scans, phase
pipelines, and bounded refactor gates.

Move repo-specific long procedures into `docs/agents/**` instead of expanding
root guidance. Examples: release process, CI log investigation, GPU setup,
visual validation workflow, PR fix strategy, dependency bootstrap, and
environment-specific caveats.

## Stop Conditions

Stop after a proposal when:

- init output and repo evidence disagree in a way that changes policy
- existing root guidance contains high-risk project-specific constraints
- the user asked for discussion only or report-only
- updating scripts would change how other projects are bootstrapped
- removing compatibility paths would touch a broad command, install,
  generated-output, or user-facing surface

Stop after edits when:

- `AGENTS.md` and `CLAUDE.md` are project-local and aligned
- target-repo underlying LSP config is configured, refreshed, already covered by
  existing repo tooling, or explicitly skipped with a concrete reason
- agent-facing Serena/MCP LSP is configured, refreshed, already covered by an
  existing MCP entry, or explicitly skipped with a concrete blocker or approval
  request
- root files are slim enough to scan, or remaining length is justified by
  critical first-read safety rules
- stale symlink-first guidance has been removed or explicitly narrowed to
  shared assets
- copied human-facing project state has been replaced with stable pointers to
  the human docs that own it
- long operational procedures have been extracted to `docs/agents/**`, skills,
  scripts, or human docs as appropriate
- preferred skills are routed by task, not mandated for every turn
- validation/search checks show no obvious stale claims in touched files
