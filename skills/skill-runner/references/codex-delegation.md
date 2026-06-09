# Codex Delegation Policy

Codex native subagents are not a stable execution surface for this harness. Do
not use Codex `spawn_agent`, native subagents, or multi-agent fanout for routine
work.

Use this policy for Codex sessions:

- Keep small read-only probes and tiny edits in the main session.
- Use `$skill-runner` or an explicit tmux-backed `codex exec` worker for
  isolated, long-running, stateful, or durable sub-phases.
- Keep the main session responsible for route decisions, canonical docs,
  integration, diff review, and final verification.
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
Codex config and route delegation through tmux-backed workers instead.
