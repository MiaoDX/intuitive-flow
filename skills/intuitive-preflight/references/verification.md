# Verification gates

Read when choosing the proof needed for the proposed success claim.

## Verification Completeness Rule

Preflight must include every verification gate needed to make the success claim
honest.

Default to requiring all relevant validation layers for the changed behavior:
static/lint/type checks, unit tests, focused contract tests, integration tests,
and manual or local live proof gates when the behavior depends on an agent
pipeline, provider route, simulator, Docker service, hardware, UI interaction,
or other runtime boundary. Do not omit a gate merely because it is local-only,
credentialed, Docker-backed, provider-backed, slow, hardware-dependent, or
requires a real simulator. Instead classify it explicitly:

- required deterministic gate;
- required integration gate;
- required product-run gate;
- required local/live/manual gate;
- optional exploratory gate.

### Runnable Product Proof Rule

Do not stop at code-local tests when the change affects a user-facing run
surface, operator console route, coding-agent workflow, agent prompt/runtime,
MCP server, simulator-backed task, report artifact, or demo contract. The
preflight must name the cheapest public command or manual flow that actually
exercises the changed behavior end to end, then add any higher-fidelity local
or human-only proof needed before claiming success.

For every affected public route or task intent, include at least one product
run gate unless the plan is explicitly docs-only or test-only. If the run needs
credentials, Docker, simulator assets, GPU, hardware, a provider, or human UI
judgment, keep that gate in the contract as local/live/manual proof and mark it
unavailable here when needed.

Required integration, product-run, local/live, and manual acceptance gates are
completion gates, not decoration. If a required gate validates the changed
behavior and cannot run in the current environment, default to
`BLOCKED_NEEDS_LOCAL_VALIDATION` rather than `PARTIAL`; the work may produce an
intermediate branch, but it is not complete, merge-ready, or no-regression until
the required gate passes. Use `INTERMEDIATE_ONLY` only when the user explicitly
asks for or approves an incomplete checkpoint, and state the missing proof and
why it blocks full success.

Preflight itself does not execute tests. It records the gates that execution
must run or explicitly report as unavailable.
