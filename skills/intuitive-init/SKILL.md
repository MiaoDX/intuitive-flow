---
name: intuitive-init
description: |
  Initialize, audit, aggressively slim, merge, and refresh project-local
  AGENTS.md and CLAUDE.md files from existing repo guidance, agent /init
  suggestions, stdin-bundled Codex init-style discovery, and intuitive workflow
  defaults, including target-repo LSP and agent-facing Serena MCP setup. Use
  when setting up a repo for Claude Code/Codex, replacing symlinked agent files
  with local guidance, rerunning agent init after weeks of drift, cleaning
  overgrown root agent files, or aligning a repo to intuitive-doc,
  intuitive-tests, intuitive-flow, intuitive-refactor, and
  intuitive-reduce-entropy without overwriting project-specific hints. When the
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
   `docs/human/**`, and equivalent files named by the repo;
3. existing project-local agent guidance;
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
5. Prefer deterministic hooks/tools for lint, format, setup, and verification
   rules instead of expanding root prose.
6. For large repos and monorepos, prefer nested `AGENTS.md` / `CLAUDE.md` files
   only when local scope differences are real.
7. Verify the final files are concise, local, and non-contradictory.

## Root Guidance Shape

Root `AGENTS.md` and `CLAUDE.md` should answer:

- Why this repo has special rules.
- What the agent must know before acting.
- How to run setup, tests, verification, demos, and safe workflows.
- Where to find durable human docs and agent runbooks.
- What must not be done in this repo.

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

- Audit: report current guidance health, drift, duplication, and missing local
  hazards. Do not edit unless asked.
- Apply/create: produce local `AGENTS.md` and `CLAUDE.md` from repo evidence and
  accepted defaults.
- Refresh: merge current repo truth and generated init suggestions into
  existing local guidance.
- Slim/cleanup: remove stale, duplicated, generic, or overgrown root guidance
  while preserving local invariants.
- Symlink migration: replace linked or external guidance files with
  project-local files that preserve the target repo's rules.

## Stop Conditions

Stop when root agent guidance is local, concise, and aligned with current repo
truth; long detail is routed to appropriate local docs/skills/scripts; and any
LSP/MCP setup is either configured, documented as blocked, or explicitly parked.

Report changed files, verification run, remaining risks, and whether generated
init output was merged, rejected, or not used.
