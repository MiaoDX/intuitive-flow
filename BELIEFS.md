# Beliefs

## AI Agents Write The Code

The human job is not to type implementation. The human job is to decide what
matters, maintain taste, and keep the proof boundary honest.

## Two Surfaces

A repo should have a human surface and an agent surface.

The human surface is small:

- `README.md`
- `ARCHITECTURE.md`
- `STATUS.md`
- `docs/human/**`

Humans also own taste, layout choices, tests, and harness quality. Those are
project responsibilities, not extra source-of-truth surfaces.

The agent surface is everything else:

- source code
- plans
- generated reports
- execution logs
- retrospectives
- scratch notes
- implementation evidence

Humans can inspect the agent surface. They should not need to read it during
normal development.

## Harness Over Supervision

Do not supervise agents by reading every diff like a tired compiler.

Build harnesses. Keep tests meaningful. Make docs accurate. Let agents run.

## Community First

Do not maintain a private skill if the community already has a better one.

Our skills should be small, intuitive, and durable. They should guide the agent,
not trap it in a brittle script.

## Big Questions First

Spend human attention on what matters:

- what to build
- who it is for
- what good means
- what must not break

Use `intuitive-flow` for ordinary idea shaping, or `agent-planning-loop`
when the question needs scouts to challenge options before one review packet.
Everything else should be cheap.

## Default Loops

Use `intuitive-flow` for normal development.

Use `intuitive-refactor` when you have time to clean the system, or as a
routine maintenance loop.

Everything else should support those loops, not become another surface humans
have to manage.

## Docs As Rebuild Spec

The human docs should be strong enough that another agent could rebuild the
project in another language, framework, or runtime.

If that is impossible, the docs are not honest enough yet.
