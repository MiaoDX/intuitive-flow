# Codex Guide

## Environment

- Use `fetch-mcp` instead of Fetch/WebFetch (network issues in China Mainland).
- Use Bash for orchestration entrypoints and Bun-run TypeScript for structured script logic.
- For Python work, use `uv` and `.venv` instead of the system interpreter.
- Avoid adding Python project dependencies unless a workflow truly needs Python-specific libraries.

## Delegation And Verification

- See `skills/skill-runner/references/codex-delegation.md` before choosing a Codex delegation surface.
- Default to parallel delegation for independent, read-heavy, or verification-heavy subtasks, but do not use Codex native subagents by default.
- Keep the main thread focused on requirements, architecture decisions, integration, and final synthesis.
- Delegate when a task has 2+ independent workstreams, requires reading many files, logs, or test outputs, or when verification can run in parallel with implementation.
- Return summaries to the main thread, not raw notes or long log dumps.
- On Codex, use the host-provided Paseo subagent tool for parallel read-heavy scouts, review passes, verification/log probes, and short bounded independent tasks when it is available and a no-edit provider/model probe succeeds. Do not invoke `paseo run` or `paseo agent run` from skills; those create separate user-visible sessions/tabs.
- If Paseo is unavailable or the provider/model probe fails, use main-session probes or `$skill-runner` / tmux-backed `codex exec` workers instead of `spawn_agent` or native subagents until local revalidation proves the installed release is stable.
- On Claude Code, native subagents remain acceptable when the host supports them reliably and file ownership is explicit.
- Prefer 2-4 delegated workers by default. Scale up only for clearly partitioned work.
- Match worker model strength to task complexity rather than defaulting everything to the highest-cost model.
- This repo often runs through an API relay with a single allowed model; default Codex workers to the main session model, and only override the model after confirming the target ID is actually available.
- For concurrent edits, assign disjoint ownership and avoid overlapping write scopes.
- Do not wait idly for delegated workers if non-overlapping local work is available.
- Do not mark work complete without verification. Run relevant tests, inspect logs, or otherwise demonstrate correctness.

## Development And Testing

- Read files before editing. Keep commits atomic. Do not amend unless asked.
- If a push is rejected because the origin branch moved, fetch and rebase onto
  origin instead of creating a merge commit. Do not force-push unless asked.
- After each significant change, run the related UTs to avoid regressions.
- Prefer real dependencies and realistic data flows over excessive stubs or mocks. Stub only truly external or expensive boundaries.
- Add visualization-oriented validation when the project supports it and numeric or log checks can miss geometry or rendering errors.
- For bug reports and failing CI, start from the failing test or log signal and drive to a verified fix.

## Preferred Skills And Workflow Routing

- Use `$intuitive-init` when creating or refreshing project-local `AGENTS.md` / `CLAUDE.md`. Treat `/init` output as suggestions to merge, not as an overwrite source.
- Use `$intuitive-doc` for human-facing docs, especially `README.md`, `ARCHITECTURE.md`, `STATUS.md`, and `docs/human/**`.
- For repo/folder organization, route by object: `$intuitive-doc` for human
  docs, `$intuitive-tests` for tests, `$intuitive-refactor` for code/package
  layout, and `$intuitive-reduce-entropy` when the owner is unclear.
- Use `$intuitive-tests` for test suite organization, markers, pruning, fixtures, and behavior-focused unit tests.
- Use `$intuitive-flow` as the default build/change entrypoint; it routes small direct edits directly, cleanup/refactor targets to `$intuitive-refactor`, and large staged work through plan/review/GSD execution.
- Use `$intuitive-preflight` before executing a plan or vague task when context package, scope, non-goals, definition of done, verification, route, or main-session `/goal` wording need human approval first.
- Use `$intuitive-refactor` before broad refactors or architecture cleanup so the target, accepted severities, evidence ladder, and stop condition are explicit.
- Use `$intuitive-squash` before PRs or branch handoff when local agent commits need a clean reviewable story.
- Keep `AGENTS.md` and `CLAUDE.md` project-local. Shared skills and commands can be synced or linked; root agent guidance should preserve each repo's own commands, constraints, and current source-of-truth rules.

## Engineering Style

- Fix root causes rather than papering over symptoms.
- Prefer minimal, local changes over speculative abstraction.
- Understand why existing code exists before changing it.
- Prefer live-at-HEAD behavior and forward migration over backward compatibility.
  For architecture design, do not preserve old APIs, commands, layouts, or
  compatibility shims as design goals. Design the organized future shape first,
  migrate known in-repo callers, and remove obsolete surfaces in the scoped
  slice. Treat a temporary bridge only as an explicitly requested migration
  tactic with a removal trigger, not as part of the target architecture.
- Fail fast with explicit errors rather than silent fallbacks.
- Do not use `hasattr()` or `getattr()` for known types. Use direct attribute access.

## Collaboration

- Treat instructions as intent. Flag contradictions, risky assumptions, or technical debt instead of blindly implementing around them.
- Ask a brief clarifying question only when a high-risk ambiguity would materially change the implementation.

## Docs And Planning

- Keep `README.md` thin and put detailed current-state setup, runtime, and interface docs in `ARCHITECTURE.md`, `STATUS.md`, and `docs/human/**`.
- Use root human docs and `docs/human/**` for human-facing truth at `HEAD`; use `.planning/` for locked project summaries and execution state, and treat generated release notes, archives, and spec areas as historical material unless promoted.
- When a refactor changes runtime truth, update the relevant root human doc or `docs/human/**` page in the same slice; if decisions or scope change too, refresh the live `.planning/` summaries as well.
- Prefer a curated ingest or merge step over broad repo-wide doc discovery when syncing planning from docs.

## Agent Notes

- This file is the source of truth for shared agent rules. `CLAUDE.md` consumes it via `@AGENTS.md` and only owns Claude-specific additions; keep all operative shared rules here because Codex does not transclude other files.
- Move reusable workflows to skills, scripts, tmux workers, or Claude Code subagents instead of expanding this file.
- If a workflow must be enforced deterministically, prefer hooks or scripts over prose in this file.
- Codex commits: include `Co-authored-by: Codex <codex@users.noreply.github.com>` trailer.
