---
name: intuitive-init
description: Create or slim project-local agent guidance and startup configuration from current repository evidence.
---

# Intuitive Init

Create, audit, refresh, or slim project-local agent guidance from current repo
evidence. Preserve commands, hazards, permission boundaries, and ownership rules.
Generated init output is a suggestion to merge, never an overwrite source.

For ordinary guidance edits, inspect the target file and the commands/docs it
references. Do not require a repo-wide scan, nested agent, or full manual read.
Keep shared rules in AGENTS.md and Claude-only additions in CLAUDE.md. Use
$intuitive-doc for broad human-documentation cleanup.

## Read for the selected task

| Task | Detail to read when needed |
| --- | --- |
| Guidance health audit | [Audit criteria](references/detailed-guidance.md#audit) |
| Initial creation or refresh | [Apply](references/detailed-guidance.md#apply), [Refresh](references/detailed-guidance.md#refresh), and [merge rules](references/detailed-guidance.md#merge-rules) |
| Startup-context pressure | [Startup hygiene](references/detailed-guidance.md#startup-orientation-hygiene) and [cleanup](references/detailed-guidance.md#startup-context-cleanup) |
| Long root instructions | [Slim / cleanup](references/detailed-guidance.md#slim--cleanup) |
| Root file linked to a shared toolkit | [Symlink migration](references/detailed-guidance.md#symlink-migration) |
| Native init suggestions are useful | [Init discovery](references/detailed-guidance.md#agent-init-discovery) |
| LSP, Serena, language server, or MCP setup | [Tool setup](references/lsp-and-mcp.md) before editing configuration |

Use the indicated sections, not the entire detailed guide. Extract long procedures
only when they have a real consumer, and leave a task-specific pointer at the root.
Keep credentials and machine-local paths out of committed guidance.

When durable Intuitive workflow adoption is in scope, preserve the repo's
planning/status paths and explicit project-integrator ownership. Do not create
STATUS.md or new state machinery as a side effect of a guidance cleanup.
Do not create `STATUS.md`, a validator, or a status directory merely because Init ran.

Report changed files, verification, remaining risks, and whether generated init
suggestions were merged, rejected, or not used. Stop when the accepted guidance
scope is current, concise, and linked to the relevant detail.
