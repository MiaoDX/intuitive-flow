# Delegation Policy

This is the host-neutral entry for worker delegation. Read the section for the
current host only; the other host's mechanics are noise for this session.

## When To Delegate

Use the main session for bounded sequential work, including long or durable
tasks. Delegate only when independent parallel work, context isolation, or
recovery across sessions is a concrete benefit, and name that benefit. A long
task or a plan file alone does not require a worker.

## Worker Contract (all hosts)

- Give each worker one bounded sub-phase, the paths it owns, the proof to run,
  and the handoff to return.
- Workers return a structured result: status, changed paths, verification, and
  open risks. A completion notification alone is not proof.
- Prompt-level ownership is not runtime isolation. Allow at most one mutating
  worker per worktree unless write paths are clearly disjoint, and have the
  main session inspect the combined diff and run the final proof.
- The main session keeps routing, integration, and the final complete/blocked
  decision. If delegation is unavailable, run the same stages inline and say so.

## Host Specifics

- **Claude Code:** use native subagents (the Agent/Task tool, or project agents
  in `.claude/agents/*.md` when a repo defines them). Read-only probes suit an
  explore-style agent with restricted tools; parallel probes can run in one
  batch.
- **Codex:** follow [Codex delegation](codex-delegation.md) for the native-v2
  capability probe, thread limits, and the Paseo/tmux fallbacks.
- **Other hosts:** use the host's approved worker surface under the contract
  above, or run inline.
