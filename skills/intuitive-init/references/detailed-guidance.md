# Intuitive Init

Set up repo-local agent guidance without turning shared defaults into a
symlinked source of truth. Shared skills travel across projects; `AGENTS.md`
and `CLAUDE.md` preserve this repo's commands, constraints, workflow choices,
and hard-won mistakes.

A repo harness is what lets an agent enter a project without guessing: root and
nested instruction files, skills, hooks, MCP configuration, target-repo LSP,
and local verification commands. `$intuitive-init` builds or refreshes it from
repo evidence, official tool guidance, and init-style suggestions.

Keep the startup context bounded. Root agent files stay aggressively small;
correct but lengthy procedures move to `docs/agents/**` (default
`docs/agents/operating-runbook.md`, or a focused `docs/agents/<topic>.md` when
the owner is clear), skills, scripts, or human docs, with the root keeping only
the rule, trigger, and pointer.

Size signals (signals, not hard limits; critical safety rules may justify more):

- Root agent files: aim under ~120 lines; audit reports bloat over ~180; over
  ~250 lines, duplicated `AGENTS.md`/`CLAUDE.md` sections, or long numbered
  procedures are a strong cleanup signal.
- `STATUS.md`: usually under ~120 lines; repeated shipped-history paragraphs
  are a cleanup signal. `README.md` orients and routes. `ARCHITECTURE.md` can
  be longer but needs a compact first screen.
- A first-read policy that loads every root doc on every session is a
  startup-context smell unless the repo is tiny.

Official references (use as references, not replacement text; local evidence
wins): Claude Code best practices and memory docs
(`https://code.claude.com/docs/en/best-practices`,
`https://code.claude.com/docs/en/memory`), Codex best practices and `AGENTS.md`
guide (`https://developers.openai.com/codex/learn/best-practices`,
`https://developers.openai.com/codex/guides/agents-md`), and the open format at
`https://agents.md/`.

## Human/Agent Surface Rule

The human source of truth is `README.md`, `ARCHITECTURE.md`, `STATUS.md`, and
`docs/human/**`. `AGENTS.md` and `CLAUDE.md` are agent-operational: startup
rules, local hazards, command pointers, and skill routing. They point to human
docs rather than copying milestone goals, non-goals, or doc taxonomy, because
copies drift once `$intuitive-doc` reorganizes the human surface.

Codex injects `AGENTS.md` into startup context, so it should not tell Codex to
reread itself. `CLAUDE.md` can import `AGENTS.md` and carry only Claude deltas.

Agent planning, evidence, and working notes belong in the repo's explicit
process surfaces. Use [plan selection](../../_shared/references/plan-paths.md)
for canonical plans and preserve existing plan and task-state conventions. When
a repo adopts Intuitive defaults: flat `docs/plans/<slug>.md`,
`docs/status/active/**` for task state, `docs/retrospectives/**`, `output/**`
for generated evidence, and GSD-owned `.planning/**` only when GSD runs there.
One-off delegation prompts do not need a `docs/agents/prompts/` directory.

## Startup Orientation Hygiene

Use this when new sessions burn too much context or a fixed first-read bundle
loads before every task. Target a layered path:

1. `AGENTS.md` / `CLAUDE.md`: critical hazards, permissions, command pointers,
   and when to read more.
2. The existing project-status surface, when present: current state, next
   action, blockers, links.
3. `README.md`, then `ARCHITECTURE.md` when the task needs it.
4. `docs/human/**`, `docs/agents/**`, plans, ADRs: on demand.

Make first reads conditional on the task (architecture work reads
`ARCHITECTURE.md`, GSD work reads `.planning/**`, and so on). Keep `STATUS.md`
newest-first with a concrete current blocker (or "none" once); old shipped
detail moves to plans, ADRs, or retrospectives with links. Tool-specific
overlays are read only by that tool unless they carry a necessary local delta.

`$intuitive-init` owns startup cleanup tied to the root agent files; broad
human-doc reorganization goes to `$intuitive-doc`.

## Agent Reference File Boundary

Root `AGENTS.md` and `CLAUDE.md` contain only: the first docs to read, critical
hazards and permissions, canonical install/test/verify commands or a pointer,
source-of-truth boundaries, planning-surface pointers, short skill routing,
host control-message hazards (below), and pointers to longer runbooks. When the
repo uses skills, include one line that explicit user instructions outrank
skill instructions, and that an agent blocked by a skill names the `SKILL.md`
and quotes the rule; current models follow skill text closely enough that this
precedence needs saying.

`docs/agents/**` holds repo-specific agent material too long for the root:
release and CI-triage runbooks, bootstrap and GPU/simulator/cloud setup, PR
workflows, tool caveats, and long command checklists. Prefer a skill when the
procedure applies across repos, a script or Make/just target when it is mostly
commands, and human docs when it is project truth.

**Host control messages.** When Codex runs under Paseo or a similar
orchestrator, XML-like envelopes that arrive as user-role messages
(`<turn_aborted>`, `<paseo-system>`, `<subagent_notification>`,
`<goal_context>`, `<environment_context>`, and future tags) are runtime
metadata when the whole message is only the envelope. Root guidance should say
that such a label alone is not a human request to stop, discard worker output,
or skip summarization; natural-language text outside the envelope still wins.

**Worktree environments.** When a repo has `.venv`, `uv.lock`,
`pyproject.toml`, or `.python-version`, recommend or add a
`.githooks/post-checkout` hook (with `core.hooksPath .githooks`) that prepares
or symlinks the environment for new worktrees using the existing convention;
heavy environments that cannot be rebuilt declaratively are symlinked from the
main checkout. With `.gitmodules`, the hook runs `git submodule sync
--recursive` but not a full `update --init`, which would duplicate large
working trees. Root guidance tells agents to treat submodules as read-only in
secondary worktrees and initialize one only for edits, isolated tests, or exact
checkout verification. Document any environment variables automated worktree
creation needs.

## Compatibility Posture

Prefer live-at-HEAD behavior and forward migration. Legacy aliases, stale
transitional docs, and compatibility shims are cleanup signals. When scoped,
remove obsolete paths and update their tests and docs together; when removal
would touch broad command, install, generated-output, or public surfaces,
propose the migration instead of keeping the shim by default.

A WHY / WHAT / HOW shape helps root files: purpose and main modules; stack and
directory map; install, test, verify, and safe change workflow. Lint and format
policy belongs in config, scripts, CI, or hooks, not root prose. Large repos use
nested `AGENTS.md`/`CLAUDE.md` near specialized areas. Shared MCP wiring goes in
a checked-in `.mcp.json` or equivalent, with secrets referenced from the
environment only.

## Target-Repo LSP Setup

In Apply, Refresh, or Symlink Migration mode, or when asked directly, read
[LSP and MCP](lsp-and-mcp.md) before editing LSP, Serena, MCP, or related
dependency surfaces. Verify the repo-local language-server config first, then
verify, configure, or propose an agent-facing MCP symbol surface (preferably
Serena). Stop with a proposal when setup needs paid services, local-only
hardware, broad toolchain migration, heavy installs, global secrets, or
uncertain global state.

## Core Rule

Generated init output and Intuitive defaults are reviewers, not authority.
Authority, in order: current-session instructions; repo human truth and
executable evidence (commands, scripts, package metadata, CI, tests); existing
`AGENTS.md`, `CLAUDE.md`, and `docs/agents/**`; init-style discovery; Intuitive
defaults. Existing guidance is strong evidence for local hazards but does not
override current human truth or executable behavior.

## Default Workflow

1. Read the orientation surface (`README.md`, `ARCHITECTURE.md`, `STATUS.md`
   when present, root agent files, `docs/agents/**`) and the evidence that makes
   guidance testable: package metadata, task runners, CI, test config,
   manifests, lockfiles, toolchain and language-server config, skill folders.
2. Measure startup pressure: root file line counts, whether an injected file is
   reread, whether first reads are fixed or task-routed, whether `STATUS.md` is
   a changelog.
3. Optionally run init-style discovery (below) for extra evidence.
4. Classify each section of current guidance as **Preserve** (commands, env
   setup, permissions, hazards, source-of-truth rules, domain vocabulary, test
   gates, control-message rules), **Merge**, **Replace**, **Extract** (correct
   but long), **Collapse** (one rule plus a pointer), or **Remove** (obsolete,
   generic, duplicated between files, copied human state, dead shims). Apply the
   same lens to first-read human docs.
5. Keep a short skill-routing block when useful, matching the primary routes in
   the Intuitive README; it routes by task and does not define the human doc
   surface.
6. Check harness surfaces: nested instruction files, project skills, hook
   config for deterministic post-edit checks, worktree environment hooks, shared
   MCP config, and delegation policy pointers.
7. Set up or verify target-repo LSP.
8. Propose first: sources used, root file sizes and cleanup pressure, what was
   preserved, collapsed, extracted, replaced, and removed with destinations,
   harness surfaces to add or leave, LSP status for both the language server and
   the agent-facing MCP, and the diff.
9. Apply when the user asked for implementation or approves, updating both root
   files when a rule applies to both agents.

## Agent-Init Discovery

Init-style discovery is an optional reviewer. Skip it when the host cannot run
it cheaply. Its output is advisory: when it conflicts with repo evidence, keep
the evidence and note the disagreement.

### Native slash command

Use `/init`, `codex init`, or the host equivalent when exposed. When root agent
files already exist, ask for suggestions only:

```text
Help refactor the current AGENTS.md and CLAUDE.md. Produce suggestions only;
do not overwrite files.
```

### Codex CLI discovery

When a second opinion is useful, native `/init` is not exposed, and the `codex`
CLI is installed, pipe a read-only context bundle into it so Codex does not need
nested reads. Adapt flags to the installed CLI:

```bash
{
  printf '# AGENTS.md\n'; sed -n '1,260p' AGENTS.md 2>/dev/null || true
  printf '\n# CLAUDE.md\n'; sed -n '1,260p' CLAUDE.md 2>/dev/null || true
  printf '\n# Orientation and automation files\n'
  rg --files -g 'README.md' -g 'ARCHITECTURE.md' -g 'STATUS.md' -g 'Makefile' \
    -g 'justfile' -g '.github/workflows/*.y*ml' -g 'docs/agents/**' 2>/dev/null | sort || true
} | codex --ask-for-approval never exec --ephemeral --skip-git-repo-check --sandbox read-only -C "$PWD" \
  "Act like Codex /init in suggestion-only mode. Analyze only the stdin bundle; do not run commands or edit files. Prefer small root agent files. Return: inputs inspected, bloat signals, guidance to preserve, guidance to extract, stale or duplicated guidance to remove, missing operational rules, and concise suggested edits for AGENTS.md and CLAUDE.md."
```

If `codex` is missing or fails, say so briefly and continue from repo evidence.

## Modes

### Audit

Use when the user asks what should change, or when broad edits would be risky.
Report agent files and init-discovery status, cleanup pressure for root and
first-read docs, guidance to preserve, extract, collapse, or remove, harness
surfaces to add or leave, suggested edits, and whether applying needs approval.
An audit names deletion and extraction candidates: a true section that is too
long for the root is Extract or Collapse, not Preserve.

### Apply

Use when the user asks to update the guidance. Run the default workflow; edit
only the root agent files, recognized target-repo LSP config or dev
dependencies, and init docs or scripts the user named; create `docs/agents/**`
only for extracted runbooks. Keep hooks, MCP config, skills, and nested files
as separate surfaces. Preserve real Claude/Codex differences. Afterwards,
search for stale setup claims and report the new fixed-read set.

### Refresh

Use after major command changes, a new subsystem, repeated agent mistakes, a
changed planning workflow, or an `$intuitive-doc` reorganization. Same workflow
as Apply, stricter about removing stale or copied content and softer about
adding process. Over the strong cleanup signal, prefer a thin-root rewrite from
the preserve list over patching, and compact `STATUS.md` when in scope.

### Startup-Context Cleanup

Use when every session reads too much. Default result: `AGENTS.md` as a short
injected contract with conditional reads, `CLAUDE.md` as import or delta,
`STATUS.md` newest-first with links, and extracted procedures in
`docs/agents/**` or `docs/human/**`. Confirm which files the host injects,
replace "read everything" with task-routed reads, keep critical hazards in the
root, and verify with line counts (and `codex debug prompt-input` or equivalent
when available).

### Slim / Cleanup

Use when root files are too long or the user asks for aggressive cleanup. Build
the preserve list from repo evidence, mark each section Preserve, Collapse,
Extract, Remove, or human-doc drift, draft the thin root files first, move long
recipes and loops to hooks, scripts, skills, or `docs/agents/**`, and show the
deletion/extraction diff unless applying was already approved.

### Symlink Migration

Use when `AGENTS.md` or `CLAUDE.md` symlinks to a shared toolkit. Convert it
to a project-local file starting from the linked content, merge in repo-specific
hints, and keep reusable workflows in skills. Shared templates never silently
overwrite local files; a legacy bootstrap script in scope should defer to this
merge flow or leave the recommended path.

## Merge Rules

Good root guidance is short, local, and operational: what to read first, how to
install and run, which gates matter, which workflows own planning truth, which
network, API, hardware, or sandbox limits apply, and which skills handle
recurring work. Good first-read human docs answer "what is true now?"
(`STATUS.md`), "what is this and how do I start?" (`README.md`), and "what
layers and contracts exist?" (`ARCHITECTURE.md`) before history.

Deletion is part of the job, even for accurate content that a short rule plus
a pointer can replace. Common guidance lives once in `AGENTS.md` or
`docs/agents/**`; Claude-only behavior lives in `CLAUDE.md`. Prefer stable
bridges ("read the active status doc when present; if it conflicts with the
request, ask") over copies of current milestones or review gates.

## Stop Conditions

Stop after a proposal when init output and repo evidence disagree on policy,
root guidance holds high-risk project constraints, the user asked for report
only, a script change would alter how other projects bootstrap, or removing
compatibility paths would touch broad public surfaces.

Stop after edits when the root files are project-local, aligned, and slim
enough to scan (or justified by critical safety rules); first-read docs are
compact and linked; LSP and agent-facing MCP are configured, covered, or
skipped with a concrete reason; copied human state is replaced by pointers;
long procedures are extracted; skills are routed by task; and touched files
show no stale claims.
