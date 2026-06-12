---
name: agent-planning-loop
description: |
  Run a bounded autonomous planning loop before implementation: use scout
  workers to apply intuitive-reduce-entropy and grill-with-docs-batch, keep the
  main session as judge, iterate until the scope is clear, then present one
  recommended plan plus alternatives for a single user review. On Codex, scout
  workers are Paseo-managed agents when available or tmux/skill-runner sessions
  otherwise, not native subagents. Use this
  whenever the user asks to "align yourselves", "run reduce entropy and grill
  batch", "use workers to refine the plan", "give me the plans after judging
  them", mentions a "planning loop", or wants faster planning without being
  pulled into every grill question.
---

# Agent Planning Loop

Use this skill when the user wants the agent system to do the planning debate
before asking for a human decision. It is a bounded orchestration workflow, not
an implementation workflow.

The point is to capture the useful 80% of agent suggestions while preventing the
remaining 20% from drifting into the wrong product direction. Scout workers
generate and challenge options; the main session owns judgment, scope control,
and the final recommendation.

## Boundary

This skill owns:

- deciding whether a planning loop is worth running;
- dispatching bounded scouts for entropy discovery and document-grounded grill;
- filtering candidates for materiality, product fit, and execution risk;
- iterating once or twice when the first pass exposes a better question;
- returning a compact recommendation set for one user review.

It does not own:

- implementation;
- approving its own plan;
- changing public contracts without user review;
- letting workers ask the user directly;
- running paid, slow, hardware, or credentialed probes unless the user already
  authorized that cost class.

After approval, route execution back through `$intuitive-flow`,
`$intuitive-refactor`, or a concrete worker prompt.

## When To Use

Use this loop for fuzzy or contested work where a normal one-shot answer would
likely miss important scope:

- a promising idea needs a clearer plan;
- previous conclusions may be overbroad or stale;
- multiple good suggestions need triage;
- docs, tests, metrics, or agent behavior may disagree;
- the user wants workers to run reduce-entropy and grill-batch before
  bringing them a synthesis.

Do not use it for one-file fixes, simple status checks, obvious bug fixes, or a
plan that already has accepted scope and verification.

## Main-Session Control Model

Keep the main session as the control plane.

- The main session writes the charter and stop gates.
- Scouts return structured summaries, not raw notes.
- The main session decides which findings survive.
- Scouts never expand scope or ask the user questions directly.
- If a scout finds a product, contract, safety, cost, or user-explicit
  temporary compatibility/migration-bridge decision, it marks
  `needs_user_review`; it does not decide. Do not treat ordinary compatibility
  removal as a user-review decision by itself.

Follow `$skill-runner`'s Codex delegation policy. On Codex, scouts are
main-session work, Paseo-managed agents when available and probed,
`$skill-runner`, or explicit tmux-backed `codex exec` workers, not native
subagents. If no worker mechanism is available, run the same stages inline and
state that delegation was unavailable.

## Loop Shape

Default to at most two rounds.

```text
charter
 -> entropy scout
 -> main-session materiality filter
 -> grill scout
 -> main-session synthesis
 -> optional second round
 -> user review packet
```

Round 1 discovers and challenges. Round 2 is only for a narrowed target where
the first round found a materially better question or split the work into
competing plans. A third round is a smell: stop and ask the user, unless the
user explicitly requested deeper autonomous planning.

## Charter

Start every loop with a compact charter.

```text
Planning loop charter:
Goal: <what decision or plan must become clear>
Non-goals: <what will not be planned or executed>
Context to inspect: <docs, code, artifacts, issues, logs>
Allowed worker actions: <read-only | docs draft | code audit | no network | no paid probes>
User-review gates:
- <contract/product/cost/safety decisions that cannot be made autonomously>
Stop when:
- <clear plan exists | no material candidates | user decision required>
```

If the charter cannot be written without guessing the user's product intent,
ask one concise question instead of running the loop.

## Worker Prompts

Use one scout per independent concern. Keep prompts short and bounded.

### Entropy Scout

Ask the entropy scout to use `$intuitive-reduce-entropy` semantics without
executing changes:

```text
Use $intuitive-reduce-entropy in plan entropy mode for this charter unless the
charter is explicitly repo-maintenance work.
Return 3-7 material candidates only if they prevent false confidence, live
source drift, stale surface, real workflow friction, or recurring rediscovery.
For each candidate include: severity, evidence, affected paths, why now, owner
skill, suggested proof, execution risk, and whether it needs user review.
Do not propose wording polish or implementation-only details.
```

### Grill Scout

Ask the grill scout to use `$grill-with-docs-batch` semantics against the
surviving candidates or draft plan:

```text
Use $grill-with-docs-batch in read-only critique mode. First run a saturation
audit. Ask no user-facing questions. Instead classify unresolved points as:
implementation default, maintainer preference, user-review decision, or stop
gate. Challenge terms against the repo glossary/context, public contracts,
private-data boundaries, acceptance gates, and verification.
Return recommended defaults and the exact decisions that still need the user.
```

### Skeptic Scout

Use this only for high-risk or broad plans:

```text
Review the current recommended plan as a skeptic. Look for over-design,
scope drift, missing proof, hidden cost, user-preference assumptions, and
alternatives that preserve more optionality. Return blockers first, then the
smallest safer plan if the recommendation is too broad.
```

## Main-Session Filter

After each scout returns, classify every item:

- `accept`: material and inside the charter;
- `merge`: useful only as part of another candidate;
- `park`: plausible but outside the current charter;
- `reject`: polish, duplicated, weak evidence, or wrong direction;
- `needs_user_review`: materially changes product, public contract, private
  boundary, cost, hardware, user-explicit temporary compatibility/migration
  bridge, or rollout risk.

Reject quota filling. A loop with one strong plan is better than three weak
ones.

## Stop Gates

Stop the loop and report when any of these is true:

- one plan has clear scope, non-goals, acceptance criteria, and verification;
- remaining questions are implementation defaults;
- the best remaining candidates are only polish;
- a user-review decision blocks honest planning;
- two rounds produced the same recommendation;
- scouts disagree because the charter is underspecified.

## Output

Return a review packet, not a transcript.

```text
Planning loop status: READY_FOR_REVIEW | NO_MATERIAL_PLAN | NEEDS_USER_DECISION

What I ran:
- <entropy scout scope>
- <grill scout scope>
- <optional skeptic scout scope>

Rejected or parked:
- <candidate> - <reason>

Recommended plan:
Goal:
Scope:
Non-goals:
Acceptance criteria:
Verification:
Risk:
Why this plan:

Alternatives:
- Conservative: <what it does, why not recommended>
- Exploratory: <what it tests, why not first>

User decisions:
- <decision, why it matters, recommended default>

Next execution route:
- <main direct | $intuitive-refactor | durable $intuitive-flow | skill-runner>
```

If no material plan remains, say so directly and explain what evidence caused
the stop. Do not fill the packet with weak alternatives.

## Approval Handling

If the user approves the review packet, do not rerun the planning loop unless
their approval changes scope. Route to the named execution path.

If the user pushes back on part of the recommendation, treat that as new charter
input. Rerun only the affected scout stage, not the whole loop.
