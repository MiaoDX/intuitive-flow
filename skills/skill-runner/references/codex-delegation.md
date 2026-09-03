# Codex Delegation Policy

This is the canonical route for Codex worker selection. The managed config is a
preference; the host-provided tool surface and system safety constraints are the
runtime authority.

## Route Selection

First check whether the current host exposes the native v2 lifecycle surface:
`spawn_agent`, `send_message`, `followup_task`, `wait_agent`,
`interrupt_agent`, and `list_agents`. Run a small no-edit probe that confirms
spawn, parent result delivery, and clean exit before trusting native routing.

| Task shape | Route |
| --- | --- |
| Read-only exploration, review, log analysis, or verification | Native v2 when the capability probe passes; otherwise Paseo or main-session probes |
| Short, independent read-only fan-out | Native v2 when available and healthy |
| Long-running, resumable, stateful, or artifact-sensitive work | `skill-runner`/tmux-backed `codex exec` |
| Shared state, overlapping writes, commits, migrations, or strict ownership | `skill-runner`/tmux, or main-session coordination |
| Host lacks native v2 or the probe fails | Paseo when its worker surface is available; otherwise `skill-runner`/tmux |
| Explicit request for Paseo | Paseo |

Native v2 is not a file-isolation mechanism. All agents may share the workspace,
and ownership in a prompt is not runtime enforcement. For any native mutation,
give the worker exact owned paths, prohibit edits outside them, require it to
preserve existing changes, and have the main session inspect the combined diff
and run the final tests. Use at most one mutating native worker unless the
paths are obviously disjoint.

## Lifecycle Contract

- Keep fan-out bounded by the session limit. The default v2 cap is four total
  threads including the root, so normally three subagents can run at once.
- Require a structured worker result with status, changed paths, verification,
  and open risks. A completion notification alone is not proof.
- Inspect `list_agents`/status before accepting results; use `wait_agent`,
  interruption, and follow-up deliberately rather than leaving orphaned work.
- Keep route decisions, integration, diff review, and final verification in the
  main session.
- Do not call `paseo run` or `paseo agent run` from skills. Those commands create
  separate user-visible sessions; use the host's Paseo surface when explicitly
  selected or when it is the configured fallback.

The installed Codex version and host should be re-probed after major upgrades.
