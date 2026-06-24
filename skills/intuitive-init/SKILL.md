---
name: intuitive-init
description: |
  Initialize, audit, aggressively slim, merge, and refresh project-local
  AGENTS.md and CLAUDE.md files from existing repo guidance, agent /init
  suggestions, stdin-bundled Codex init-style discovery, and intuitive workflow
  defaults, including target-repo LSP and agent-facing Serena MCP setup. Use
  when setting up a repo for Claude Code/Codex, replacing symlinked agent files
  with local guidance, rerunning agent init after weeks of drift, cleaning
  overgrown root agent files, or configuring agent-facing LSP/MCP guidance
  without overwriting project-specific hints. Route human docs, test layout,
  execution flow, refactor scope, and entropy discovery to their own skills
  unless the change is only the agent guidance that points at them. When the
  user asks to "setup LSP" for a coding-agent repo, treat Serena MCP as the
  preferred agent-facing LSP path unless it is already configured or concretely
  blocked.
---

# Intuitive Init

Use this skill to create, audit, slim, merge, or refresh project-local
`AGENTS.md` and `CLAUDE.md` guidance for Claude Code and Codex. The output
should make the target repo easier for future agents without replacing local
truth with a generic process manual.

This compact entrypoint preserves the full original guidance in
`references/detailed-guidance.md`. Read that file for edge cases, full merge
rules, init discovery variants, symlink migration, or mode-specific detail.
Read `references/lsp-and-mcp.md` before editing LSP, Serena, MCP,
language-server, or agent-facing tool setup.

## Source Priority

Respect this source hierarchy:

1. current system/developer/user instructions;
2. repo-local human truth: `README.md`, `ARCHITECTURE.md`, `STATUS.md`,
   `docs/human/**`, equivalent files named by the repo, and executable repo
   evidence such as package metadata, scripts, CI config, and tests;
3. existing project-local agent guidance and `docs/agents/**` operational
   runbooks;
4. generated `/init` or `codex init` suggestions;
5. intuitive workflow defaults.

Generated init output is input to merge, not authority to overwrite local
guidance.

## Default Workflow

1. Inspect the target repo's current root docs and existing agent guidance.
2. Classify the request:
   audit, apply/create, refresh, slim/cleanup, symlink migration, or LSP/MCP
   setup.
3. Preserve project-specific commands, hazards, test gates, and current source
   of truth.
4. Move long operational procedures out of root guidance into durable repo
   locations such as `docs/agents/**`, skills, hooks, scripts, or human docs.
5. For Codex/Paseo harnesses, preserve or add a short rule that XML-like host
   control envelopes such as `<turn_aborted>`, `<paseo-system>`,
   `<subagent_notification>`, `<goal_context>`, and `<environment_context>` are
   orchestrator metadata unless accompanied by natural-language user intent.
   They must not be treated as a human stop request by themselves.
6. Prefer deterministic hooks/tools for lint, format, setup, and verification
   rules instead of expanding root prose.
7. For large repos and monorepos, prefer nested `AGENTS.md` / `CLAUDE.md` files
   only when local scope differences are real.
8. Verify the final files are concise, local, and non-contradictory.

## Root Guidance Shape

Root `AGENTS.md` and `CLAUDE.md` should answer:

- Why this repo has special rules.
- What the agent must know before acting.
- How to run setup, tests, verification, demos, and safe workflows.
- Where to find durable human docs and agent runbooks.
- Where fixed plan contracts, active capsules, and GSD-owned execution state
  live.
- What must not be done in this repo.
- How host control metadata affects stop/continue decisions when the repo uses
  Paseo or another orchestrator.

When root guidance names planning surfaces, keep it stable: canonical plans are
`docs/plans/<slug>.md`, compact resume state is
`docs/status/active/<task-slug>.md`, and `.planning/*` is owned by GSD tools.
Do not recommend `.continue-here.md`, manual `.planning/HANDOFF.json`, or
one-off prompt folders as default repo surfaces.

Avoid copying broad official docs or all intuitive workflow rules into each
repo. Distill only the local invariant and point to local tools/docs for detail.

## LSP And MCP Setup

When the task is LSP, language-server, Serena, or MCP setup:

1. Read `references/lsp-and-mcp.md`.
2. Check whether the target repo already has a working project-local setup.
3. Prefer Serena MCP as the agent-facing LSP path for coding-agent repos unless
   the target repo already has a better concrete setup or the host cannot run
   it.
4. Keep credentials, machine-local paths, and private endpoints out of committed
   guidance.

## Modes

| Mode | Use when | Output | Redirect when |
| --- | --- | --- | --- |
| Audit | Existing guidance may be stale, bloated, or missing local hazards. | Guidance health report and recommended edits; no changes unless asked. | The issue is human docs, tests, or code layout. |
| Apply/create | A repo lacks local `AGENTS.md` / `CLAUDE.md` or needs initial setup. | Project-local guidance from repo evidence and accepted defaults. | The user wants only current-state human docs. |
| Refresh | Existing local guidance needs current repo truth or init suggestions merged. | Updated guidance with stale/generic content removed. | Generated init output should only be reviewed, not applied. |
| Slim/cleanup | Root guidance is overgrown, generic, duplicated, or stale. | Shorter root guidance with long detail routed to durable homes. | The long detail belongs in human docs owned by `$intuitive-doc`. |
| Symlink migration | Root guidance is linked to shared/external files. | Project-local files preserving target repo rules. | The repo intentionally owns external guidance as its contract. |
| LSP/MCP setup | The request names LSP, language server, Serena, or MCP setup. | Agent-facing setup or a concrete blocked/parked reason. | The target already has a better concrete setup. |

For non-trivial runs, state `Selected mode:`, `Why:`, and `Redirect:` before
auditing or editing. For tiny direct changes, one sentence can carry the same
information. Add a final `Mode note:` only when manual invocation, ambiguity, or
a better owner matters.

## Stop Conditions

Stop when root agent guidance is local, concise, and aligned with current repo
truth; long detail is routed to appropriate local docs/skills/scripts; and any
LSP/MCP setup is either configured, documented as blocked, or explicitly parked.

Report changed files, verification run, remaining risks, and whether generated
init output was merged, rejected, or not used.
