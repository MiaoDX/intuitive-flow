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

For Codex sessions running under Paseo or a similar orchestrator, the harness
also needs a small stop/continue guard: XML-like host control envelopes that
arrive as user-role messages are runtime metadata when the whole message is only
the envelope. Examples include `<turn_aborted>`, `<paseo-system>`,
`<subagent_notification>`, `<goal_context>`, `<environment_context>`, and future
unknown tags. Root guidance should tell agents not to infer that the human asked
to stop, discard worker output, or skip summarization from those labels alone;
natural-language user text outside the envelope still wins.

Default posture: keep the startup context bounded. `AGENTS.md` and `CLAUDE.md`
should be aggressively small, and any human docs they force agents to read
before acting should be reasonable orientation surfaces rather than unlimited
logs. Correct but lengthy procedures should usually move out of root startup
files into `docs/agents/**`, reusable skills, scripts, or human docs, with the
root files keeping only the rule, trigger, and pointer.

When extracting mixed repo-specific agent procedures, prefer the standard file
name `docs/agents/operating-runbook.md`. Use narrower
`docs/agents/<topic>.md` files only when the procedure has a clear standalone
owner, such as issue tracking, triage labels, release, or domain vocabulary.

Use these size signals:

- Target: each root agent file is short enough to skim before work starts,
  usually under 120 lines.
- Warning: over 180 lines means audit should report bloat and propose deletes or
  extraction.
- Strong cleanup signal: over 250 lines, duplicated sections between
  `AGENTS.md` and `CLAUDE.md`, or long numbered procedures in root files.

These are signals, not hard limits. Keep a longer root file only when the
content is a critical safety rule that agents must see before any other read.

For root human orientation docs, use softer but real pressure signals:

- `STATUS.md` should usually fit under about 120 lines. Over 180 lines or
  repeated shipped-history paragraphs is a cleanup signal.
- `README.md` should orient, route, and list runnable entrypoints; long setup or
  operator detail belongs under `docs/human/**`, `docs/agents/**`, or scripts.
- `ARCHITECTURE.md` can be longer, but it needs a compact first screen that
  names the active layer map and tells agents what to read next.
- Any first-read policy that requires `README.md`, `ARCHITECTURE.md`,
  `STATUS.md`, `AGENTS.md`, and tool-specific files on every session should be
  treated as a startup-context smell unless the repo is tiny.

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

Because Codex injects `AGENTS.md` into the model-visible startup context,
`AGENTS.md` should not instruct Codex to reread itself. It may say "this file is
already startup context when injected" and then route additional reads by task.
Claude may import `AGENTS.md` from `CLAUDE.md`; avoid duplicating the same long
repo rules in both files.

Agent planning, generated evidence, history, and working notes belong in
explicit agent/process surfaces such as GSD-owned `.planning/**`, flat
`docs/plans/<slug>.md` plan contracts, `docs/retrospectives/**`,
`docs/status/active/**`, and `output/**` unless a human doc intentionally
promotes a specific artifact into current truth.

Keep the plan file surface fixed: one canonical plan file at
`docs/plans/<slug>.md`, lifecycle in that plan's status fields, and compact
current execution state in `docs/status/active/<task-slug>.md`. Do not introduce
plan lifecycle subdirectories, `.continue-here.md`, or manual
`.planning/HANDOFF.json` as recommended repo surfaces.

AI coding docs are agent/process-facing docs that help future coding agents but
do not need to be human project truth. Prefer `docs/agents/**` for durable
agent runbooks, repo-specific coding procedures, tool quirks, and long harness
notes. For mixed operating detail, prefer
`docs/agents/operating-runbook.md` as the cross-repo default name. Do not create
`docs/agents/prompts/` for one-off delegation prompts by default; promote
reusable agent rules to a durable runbook instead. Prefer GSD-owned
`.planning/**`, flat `docs/plans/<slug>.md`,
`docs/retrospectives/**`, `docs/status/active/**`, and `output/**` for
execution state, plans, retrospectives, generated evidence, and proof artifacts.

Agent files may point to human-authoritative docs and say how agents should
react when those docs conflict with a request. Do not copy milestone goals,
non-goals, steering policy, documentation taxonomy, or other human-facing
project state into agent files. Those copied blocks drift after `$intuitive-doc`
cleans or reorganizes the human surface.

## Startup Orientation Hygiene

Use this when the user complains that new sessions burn too much context, or
when first-read policies force a large fixed bundle before every task.

The target shape is a small, layered startup path:

1. `AGENTS.md` / `CLAUDE.md`: critical hazards, permission boundaries, command
   pointers, and when to read more.
2. `STATUS.md`: newest current state, next action, blockers, and links to
   active source-of-truth docs.
3. `README.md`: project orientation and public commands.
4. `ARCHITECTURE.md`: layer map, current contracts, and extension points.
5. `docs/human/**`, `docs/agents/**`, plans, ADRs, and runbooks: read on demand.

Rules:

- Start with `STATUS.md` for current focus unless the task is pure setup,
  architecture, or documentation.
- Put the newest and most actionable status at the top. Move old shipped detail
  to plans, ADRs, retrospectives, or `docs/human/**` and leave links.
- If `STATUS.md` needs a recent-changes section, keep it short and
  reverse-chronological. Newest changes go first; old completed changes should
  age out instead of turning the file into a changelog.
- Keep "current blocker" concrete. If there is no blocker, say so once; do not
  list every historical external validation caveat in the startup path.
- Keep first-read policies conditional: architecture work reads
  `ARCHITECTURE.md`; demo/run work reads command docs; GSD work reads
  `.planning/**`; domain naming reads domain docs.
- Do not make every agent read tool-specific overlays such as `CLAUDE.md` unless
  the current host is that tool or the file carries a necessary local delta.

`$intuitive-init` owns this startup harness cleanup when the change is tightly
coupled to `AGENTS.md` / `CLAUDE.md`. Route broad human-doc audits,
reorganizations, or generated-doc cleanup to `$intuitive-doc`.

## Agent Reference File Boundary

Use `docs/agents/**` for repo-specific agent reference material that is too long
for the root files but still useful to coding agents.

Default to `docs/agents/operating-runbook.md` for mixed agent operating detail:
setup caveats, local hazards, test wrappers, command routing, browser QA,
provider keys, git hygiene, and similar cross-cutting procedures. Use
topic-specific files only when the repo already has or clearly needs a focused
owner.

Good candidates for `docs/agents/**`:

- release procedures
- CI failure investigation runbooks
- dependency/bootstrap playbooks
- GPU, simulator, cloud, or hardware setup notes
- PR review/fix workflows
- model/tool-specific caveats
- long examples and copy/paste command checklists
- **worktree environment setup and maintenance**: when a repo uses multiple
  `.venv` variants or heavy external runtimes, document the hook script, symlink
  strategy, and any environment variables (e.g., `OMNI_KIT_ACCEPT_EULA`) that
  must be pre-configured for automated worktree creation

Prefer a reusable skill when the procedure applies across repos. Prefer a
script, Makefile target, or just recipe when the procedure is mostly commands.
Prefer human docs when the information is project truth for humans, not agent
operation.

Root `AGENTS.md` and `CLAUDE.md` should contain only:

- the first docs to read
- critical local hazards and permissions
- canonical install/test/verify commands or the pointer to them
- source-of-truth boundaries
- stable planning-surface pointers (`docs/plans/<slug>.md`,
  `docs/status/active/<task-slug>.md`, and GSD-owned `.planning/*`)
- short skill routing
- host/orchestrator control-message hazards that can change stop/continue
  behavior, especially Paseo XML-like envelopes in Codex sessions
- pointers to longer `docs/agents/**` runbooks when needed

## Compatibility Posture

Prefer live-at-HEAD behavior and forward migration over backward compatibility.
Treat `legacy`, `compatibility`, old command aliases, stale transitional docs,
and preserved historical surfaces as cleanup signals, not as things to keep
automatically.

When the change is scoped, remove or replace obsolete paths and update their
tests/docs in the same pass. If removing obsolete paths would touch a broad
command surface, install/update behavior, generated outputs, public docs, or
many files, propose the forward migration/removal plan; do not preserve a
compatibility layer as the architecture default.

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

Set up language server support as part of repo harness initialization when the
task reaches Apply, Refresh, or Symlink Migration mode, or when the user asks
for coding-agent LSP/MCP setup directly. Read
`references/lsp-and-mcp.md` before editing LSP, Serena, MCP, language-server,
or related dependency/config surfaces.

The short rule: verify the repo-local language-server config first, then verify,
configure, or propose an agent-facing MCP symbol surface, preferably Serena,
unless it is already covered or concretely blocked. Stop and report instead of
editing when setup would require paid services, local-only hardware, broad
toolchain migration, heavy installs, global secrets, or uncertain global state.

## Core Rule

Treat generated init output and Intuitive Flow defaults as reviewers, not
authority.

Authoritative inputs, in order:

1. System/developer/user instructions for the current session.
2. Repo-local human truth such as `README.md`, `ARCHITECTURE.md`,
   `STATUS.md`, `docs/human/**`, equivalent files named by the repo, and
   executable repo evidence such as commands, scripts, package metadata, CI
   config, and tests.
3. Existing project-local `AGENTS.md`, `CLAUDE.md`, and `docs/agents/**`
   operational runbooks.
4. Agent `/init`, `codex init` when available, or stdin-bundled init-style
   discovery from a read-only Codex run.
5. Intuitive Flow defaults and skill-routing conventions.

Existing agent guidance is important evidence for local operational hazards,
but it does not override current human truth or executable repo behavior.

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
3. Measure startup-context pressure:
   - line counts for `AGENTS.md`, `CLAUDE.md`, `README.md`, `ARCHITECTURE.md`,
     and `STATUS.md`
   - whether `AGENTS.md` is injected by the host and then reread manually
   - whether the first-read path is fixed or task-routed
   - whether `STATUS.md` is newest-first or a cumulative changelog
   - whether long examples/procedures belong in
     `docs/agents/operating-runbook.md`, another `docs/agents/**` file,
     `docs/human/**`, scripts, or skills
4. Use init-style discovery when it is available and worth the extra evidence:
   - Prefer `/init`, `codex init` when available, or the tool's equivalent in
     suggestion/refactor mode.
   - If `/init` refuses because `AGENTS.md` or `CLAUDE.md` already exists,
     prompt it to "help refactor the current file" rather than overwrite.
   - Capture useful suggestions only. Do not treat init output as final text.
   - If native slash commands are not exposed, either continue from repo
     evidence or use the stdin-bundled Codex CLI discovery below when the host
     supports it. Missing nested-agent support is not a blocker.
5. Classify current guidance:
   - **Preserve**: project commands, env setup, permissions, local hazards,
     workflow source-of-truth rules, domain vocabulary, test gates, and
     host/orchestrator control-message rules such as treating Paseo XML-like
     labels as metadata rather than user stop requests.
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
6. Classify root orientation docs when they are part of the first-read path:
   - **Preserve**: current commands, active contracts, next action, blockers,
     and links to current plans/ADRs/human docs.
   - **Collapse**: repeated implemented-plan summaries into a short current
     state plus links.
   - **Extract**: long run procedures to `docs/agents/operating-runbook.md`,
     a focused `docs/agents/<topic>.md`, or `docs/human/**` depending on
     audience.
   - **Remove**: stale shipped history, obsolete compatibility notes, duplicate
     links, and old validation caveats that no longer change today's work.
7. Add or refresh a short preferred-skills block when relevant:
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
8. Check harness-specific surfaces:
   - nested `CLAUDE.md` / `AGENTS.md` files for monorepos or package-local rules
   - `.claude/skills/**`, `.codex/skills/**`, `.agents/skills/**`, or
     project-owned `skills/**` for repeated workflows
   - `.claude/settings.json`, `.codex/hooks/**`, or equivalent hook config for
     deterministic checks that must run after edits
   - **Git worktree environment auto-setup**: When the repo uses `uv` (or similar
     fast package managers with global caches), prefer a `.githooks/post-checkout`
     script that automatically creates or symlinks `.venv` environments when a
     `git worktree` is created. This covers both Claude Code `--worktree` and
     Codex `git worktree add` workflows without tool-specific hooks. Configure
     `git config core.hooksPath .githooks` and ensure the script is executable.
     For heavy environments that cannot be rebuilt declaratively (e.g., NVIDIA
     Isaac Sim with system-level dependencies), symlink from the main repo instead
     of recreating. See the Roboclaws `.githooks/post-checkout` pattern for a
     concrete example.
   - checked-in `.mcp.json` or project-scoped MCP docs for shared external tools
   - Codex/Paseo delegation policy docs, when present; root guidance should
     point to the policy and keep only the short XML-envelope rule that prevents
     false auto-stop behavior
9. Set up or verify target-repo LSP:
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
10. Produce a merged proposal first:
   - Summarize the source inputs used.
   - Report root file sizes and whether cleanup pressure is low, medium, or
     high.
   - Report first-read pressure for any root human docs that agent guidance
     requires before commands.
   - Explain what was preserved, collapsed, extracted, replaced, and removed.
   - Name any new `docs/agents/operating-runbook.md`,
     `docs/agents/<topic>.md`, skill, script, or human-doc destination for
     extracted content.
   - Call out any nested instruction files, hooks, skills, or MCP config that
     should be created, left alone, or moved out of the root files.
   - Call out the target-repo LSP status separately for:
     underlying language-server config and agent-facing Serena/MCP setup.
     Mark Serena/MCP as configured, refreshed, already covered, skipped with a
     concrete blocker, or needing user approval.
   - Show the diff or proposed file contents.
11. Apply changes only when the user has asked for direct implementation or
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
First-read / orientation-doc pressure:
Project-specific guidance to preserve:
Correct but lengthy guidance to extract:
Status/README/architecture cleanup candidates:
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
9. When first-read policy changed, run a small prompt-input or line-count check
   when available, or at least report the new fixed-read set.

### Refresh

Use after several weeks, major command changes, a new subsystem, repeated agent
mistakes, or a changed planning workflow.

Run the same workflow as Apply, but be stricter about removing stale commands
and softer about adding new process. A refresh should reduce drift, not expand
root guidance into a manual.

Also use Refresh after `$intuitive-doc` has created, moved, or clarified the
human documentation surface. In that case, update agent files to point at the
final surface and remove copied project strategy, milestone state, or doc-tier
policy that now belongs in human docs. If `STATUS.md` or other first-read docs
have accumulated old shipped state, refresh may compact them while preserving
current links; route to `$intuitive-doc` only when the cleanup becomes a broad
human-doc rewrite.

Refresh is allowed and expected to delete root guidance that is obsolete,
duplicated, generic, copied from human docs, or correct-but-better-extracted.
When the root files are over the strong cleanup signal, or the fixed first-read
path is too large, prefer a thin-root rewrite over a patchwork edit: rebuild
`AGENTS.md` and `CLAUDE.md` from the preserve list, compact `STATUS.md` to
current state when it is in scope, then move long runbooks into
`docs/agents/**` or `docs/human/**`.

### Startup-Context Cleanup

Use when the user says every new session reads too much, context is wasted on
orientation, or first-read policy forces long root docs.

Default result:

- `AGENTS.md`: short injected startup contract, with conditional reads.
- `CLAUDE.md`: import or delta only.
- `STATUS.md`: latest current state first, next action, blocker, and links.
- Optional `docs/agents/operating-runbook.md`,
  `docs/agents/<topic>.md`, or `docs/human/<topic>.md`: extracted long
  procedures or history.

Steps:

1. Measure line counts and fixed-read order for all startup docs.
2. Confirm which files the host injects automatically, especially Codex
   `AGENTS.md`.
3. Replace fixed "read everything" instructions with task-routed reads.
4. Put status guidance in `STATUS.md` itself: keep it newest-first, compact,
   and pointer-based. Recent changes, if present, should be newest-first; old
   shipped history should move out.
5. Keep critical hazards in the root agent file even if they are long, but
   collapse examples into pointers.
6. Verify with line counts and, for Codex when available, `codex debug
   prompt-input` or equivalent prompt-input inspection.

### Slim / Cleanup

Use when the user says the root agent files are too long, asks for aggressive
cleanup, asks to make them "as clean as possible", or when audit finds strong
cleanup signals.

Default result:

- `AGENTS.md`: repo-wide rules all agents must see immediately.
- `CLAUDE.md`: Claude-specific deltas only, not a full duplicate of
  `AGENTS.md`.
- `docs/agents/operating-runbook.md`: default home for mixed long agent
  procedures.
- `docs/agents/<topic>.md`: extracted procedures for release, CI triage,
  environment setup, GPU/simulator setup, PR workflows, or similar focused
  long tasks.

Steps:

1. Build a preserve list from actual repo evidence.
2. Mark each current root section as Preserve, Collapse, Extract, Remove, or
   Human-doc drift.
3. Draft the thin root files first using the WHY / WHAT / HOW shape when it
   helps agents orient quickly.
4. Move lint/format details, long command recipes, and repeatable operational
   loops to hooks, scripts, skills, `docs/agents/operating-runbook.md`, or a
   focused `docs/agents/<topic>.md` as appropriate.
5. Draft extracted agent runbooks only for procedures that remain useful.
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

Good first-read human orientation is also bounded:

- `STATUS.md` answers "what is true now?" before history.
- `README.md` answers "what is this and how do I start?" before details.
- `ARCHITECTURE.md` answers "what layers and contracts exist?" before deep
  subsystem prose.
- Long history remains linked, not inlined into every startup turn.

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

Move repo-specific long procedures into `docs/agents/operating-runbook.md` by
default instead of expanding root guidance. Use focused `docs/agents/<topic>.md`
files when the owner is clear. Examples: release process, CI log investigation,
GPU setup, visual validation workflow, PR fix strategy, dependency bootstrap,
and environment-specific caveats.

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
- first-read human docs are compact enough for their role, newest-first, and
  linked to deeper detail instead of acting as cumulative logs
- stale symlink-first guidance has been removed or explicitly narrowed to
  shared assets
- copied human-facing project state has been replaced with stable pointers to
  the human docs that own it
- long operational procedures have been extracted to
  `docs/agents/operating-runbook.md`, focused `docs/agents/**` files, skills,
  scripts, or human docs as appropriate
- preferred skills are routed by task, not mandated for every turn
- validation/search checks show no obvious stale claims in touched files
