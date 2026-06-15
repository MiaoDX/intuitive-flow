# Codex Delegation Policy

Codex native subagents are not a stable execution surface for this harness. Do
not use Codex `spawn_agent`, native subagents, or native multi-agent fanout for
routine work.

Use this policy for Codex sessions:

- Keep small read-only probes and tiny edits in the main session.
- When the Paseo subagent tool is available, use Paseo subagents for
  parallel read-heavy scouts, review passes, verification/log probes, and short
  bounded independent tasks after a no-edit provider/model probe succeeds.
- Do not invoke `paseo run` or `paseo agent run` from skills. Those commands
  create separate user-visible Paseo sessions/tabs instead of subordinate
  workers controlled by the current conversation.
- Use `$skill-runner` or an explicit tmux-backed `codex exec` worker when Paseo
  is unavailable or the provider/model probe fails, and for isolated,
  long-running, stateful, mutating, artifact-sensitive, or durable sub-phases.
- Keep the main session responsible for route decisions, canonical docs,
  integration, diff review, and final verification.
- For Paseo subagents, require a structured final summary in the worker
  prompt, then inspect the host-provided Paseo subagent activity/status surface before
  trusting the result. A finish notification alone is not proof.
- Prefer the current/default Codex model surfaced by Paseo, but only after the
  provider/model probe succeeds. Do not switch to smaller or alternate model
  IDs just because they are listed.
- Treat Claude Code separately: Claude Code native subagents remain acceptable
  when the host supports them and file ownership is clear.

Codex native subagents may be reconsidered only after the installed Codex
release is revalidated for all of these behaviors in the local environment:

- spawn succeeds;
- the subagent completes;
- the parent receives the final result;
- the subagent exits cleanly without leaving the session stuck;
- file ownership, sandbox behavior, and model selection are predictable.

Until that revalidation exists, disable Codex `features.multi_agent` in managed
Codex config and route native-subagent-shaped delegation through
Paseo subagents when available or tmux-backed workers otherwise.
