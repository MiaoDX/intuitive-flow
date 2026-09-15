# Codex Guide

## Repository Rules

- Use `fetch-mcp` for network retrieval in place of Fetch/WebFetch.
- Use Bash for orchestration entrypoints and Bun-run TypeScript for structured scripts.
- For Python, use `uv` and the repository `.venv`; avoid new dependencies unless needed.
- Keep commits atomic, do not amend unless asked, and include `Co-authored-by: Codex <codex@users.noreply.github.com>`.
- If a push is rejected because the remote moved, fetch and rebase; never force-push unless asked.
- Prefer live-at-HEAD behavior and forward migrations. Remove obsolete in-repo APIs and shims; preserve a bridge only when explicitly required.
- Fail fast with explicit errors. Do not use `hasattr()` or `getattr()` for known types.

## Workflow Routing

- `$intuitive-flow` is the default build/change entrypoint.
- Use `$intuitive-reduce-entropy` when the cleanup target is unknown; use `$intuitive-refactor` for a named code or architecture seam.
- Use `$intuitive-init` for project-local `AGENTS.md` / `CLAUDE.md`; treat generated init output as input, not an overwrite source.
- Use `$intuitive-doc` for human-facing docs and `$intuitive-tests` for test-suite organization.
- Use `$intuitive-preflight` when scope, non-goals, acceptance, verification, or execution route need an approval-ready contract.
- Use `$intuitive-squash` before PR or branch handoff when local agent history needs cleanup.
- Keep shared rules here. Keep `CLAUDE.md` limited to Claude-specific additions.

## Documentation Truth

- Keep `README.md` thin. Put current setup, runtime, and interface truth in `ARCHITECTURE.md`, `STATUS.md`, and `docs/human/**`.
- Use `.planning/` for locked project summaries and execution state. Treat generated release notes, archives, and unpromoted specs as historical.
- When runtime truth changes, update the owning human doc in the same slice; refresh live planning summaries when scope or decisions change.
- Prefer curated document ingest over broad discovery when syncing planning context.

## Delegation

- Read `skills/skill-runner/references/codex-delegation.md` when delegation, native v2 probes, Paseo fallback, or durable tmux workers are involved.
- Keep host-specific worker selection in that reference. Assign disjoint ownership for concurrent edits and return summaries rather than raw logs.
- Keep the main session responsible for requirements, architecture, integration, and final verification.

## File Ownership

- This file is the shared source of truth. Move reusable workflows to skills, scripts, hooks, or worker references instead of expanding it.
- If a rule must be deterministic, enforce it with a hook or script.
