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

Use `intuitive-shape` when it is still unclear whether an idea deserves to
exist, or `agent-planning-loop` when the question needs scouts to challenge
options before one review packet. Everything else should be cheap.

## Default Loops

The primary routes are Shape, Flow, Refactor, Reduce Entropy, and Research:

- `intuitive-shape` decides whether unsettled work deserves a bounded bet.
- `intuitive-flow` executes approved plans and tiny bounded changes.
- `intuitive-reduce-entropy` finds cleanup targets; `intuitive-refactor`
  executes a selected seam.
- `research` answers questions that need multiple sources reconciled.

Everything else should support those loops, not become another surface humans
have to manage.

## Thin Skills, Strong Models

Model capability moves faster than skill text. A rule that compensated for an
older model can become noise for a newer one. Keep repo-owned skills thin: state
intent and the reason behind it, keep one canonical copy of each rule, and put
deterministic checks in scripts or hooks instead of prose.

## Docs As Rebuild Spec

The human docs should be strong enough that another agent could rebuild the
project in another language, framework, or runtime.

If that is impossible, the docs are not honest enough yet.
