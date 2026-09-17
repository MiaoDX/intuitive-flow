# Agent Guide

- Repo-owned skill sources live in `skills/`; update installed copies through the sync script.
- Use Bash for orchestration and Bun-run TypeScript for structured scripts. For Python, use `uv` and the repository `.venv`; avoid unnecessary dependencies.
- Use `fetch-mcp` for network retrieval. Fail explicitly; avoid `hasattr()` / `getattr()` for known types.
- Prefer live-at-HEAD behavior and forward migrations; remove obsolete in-repo APIs and shims unless a bridge is explicitly required.
- Keep commits atomic with `Co-authored-by: Codex <codex@users.noreply.github.com>`. Do not amend or force-push unless asked; fetch and rebase if a push is rejected because the remote moved.
- `bun run verify` checks the repo. `scripts/update.sh` mutates installed tools and user configuration; it is not a test command.

## Task routing

- Use `$intuitive-flow` for ordinary execution, `$intuitive-reduce-entropy` for unknown cleanup targets, and `$intuitive-refactor` for selected seams.
- Use `$intuitive-preflight` for unresolved scope or acceptance decisions; reuse the user's existing authorization.
- Guidance/setup belongs to `$intuitive-init`, human docs to `$intuitive-doc`, test-suite organization to `$intuitive-tests`, and requested history cleanup to `$intuitive-squash`.
- For delegation, read `skills/skill-runner/references/codex-delegation.md`; assign disjoint ownership and keep integration and verification in the main session.

## Sources of truth

- Keep README thin. Use ARCHITECTURE for boundaries, STATUS for current commands/state, and `docs/human/**` for detail, as the task requires.
- `.planning/` holds locked summaries and execution state; archives, generated release notes, and unpromoted specs are historical. Prefer curated planning ingest.
- Update the owning human doc when runtime truth changes, and active planning summaries when scope or decisions change.
- Shared rules belong here; CLAUDE.md contains Claude-specific additions. Put reusable procedures in skills and deterministic rules in scripts/hooks.
