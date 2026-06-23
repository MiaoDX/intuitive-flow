---
name: agent-planning-loop
description: |
  Run a bounded autonomous planning loop before implementation: use scout
  workers to apply intuitive-reduce-entropy and grill-with-docs-batch, keep the
  main session as judge, iterate until the scope is clear, then present one
  recommended plan plus alternatives for a single user review. Follow the
  skill-runner Codex delegation reference for host-specific worker selection.
  Use this whenever the user asks to "align yourselves", "run reduce entropy
  and grill batch", "use workers to refine the plan", "give me the plans after
  judging them", mentions a "planning loop", or wants faster planning without
  being pulled into every grill question.
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

When the loop is run against an existing plan artifact, assume the plan is the
intended execution unit unless the user asks for slice selection or the plan is
plainly too broad for their goal. Scouts may recommend phase order, stop gates,
or risk isolation, but the main-session recommendation should not quietly shrink
the final action to "only implement slice 1." If only a subset is safe, say why
full-plan execution is blocked and ask for that decision instead of presenting
the subset as the normal next action.

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

Follow the `$skill-runner` Codex delegation reference for worker selection. This
skill chooses scout scope and acceptance; the delegation reference owns all
host-specific worker mechanics. If no worker mechanism is available, run the
same stages inline and state that delegation was unavailable.

## Loop Shape

Default to at most two rounds.

Round 1 discovers and challenges. Round 2 is only for a narrowed target where
the first round found a materially better question or split the work into
competing plans. A third round is a smell: stop and ask the user, unless the
user explicitly requested deeper autonomous planning.

## Charter

Start every loop with a compact charter: goal, non-goals, context to inspect,
allowed worker actions, user-review gates, and stop condition.

If the charter cannot be written without guessing the user's product intent,
ask one concise question instead of running the loop.

## Worker Prompts

Use one scout per independent concern. Keep prompts short and bounded; invoke
the named skill semantics instead of pasting full instructions.

### Entropy Scout

Use `$intuitive-reduce-entropy` without executing changes. Return only material
candidates with severity, evidence, paths, owner, proof, execution risk, and
whether user review is needed.

### Grill Scout

Use `$grill-with-docs-batch` in read-only critique mode against surviving
candidates or a draft plan. Ask no user-facing questions; classify unresolved
points as implementation defaults, maintainer preferences, user-review
decisions, or stop gates.

### Skeptic Scout

Use this only for high-risk or broad plans:

Review the current recommended plan as a skeptic. Look for over-design,
scope drift, missing proof, hidden cost, user-preference assumptions, and
alternatives that preserve more optionality. Return blockers first. If the
recommendation is too broad for the user's stated goal, propose the smallest
safer plan; if the user supplied a plan file as the target, prefer keeping the
full plan and adding phase order plus stop gates unless full-plan execution is
actually dishonest.

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

Include: planning loop status, what ran, rejected/parked items, one recommended
plan with scope/non-goals/acceptance/verification/risk, alternatives only when
material, user decisions, `Plan artifact:`, `Recommended next action:`, and
`Shortcut:`.

For plan-file loops, the `Recommended next action` should normally execute or
preflight the whole plan through the appropriate route. It may name the first
phase as the starting point, but should not make that phase the whole approved
scope unless the user asked for that narrowing or a stop gate blocks the rest.

If no material plan remains, say so directly and explain what evidence caused
the stop. Do not fill the packet with weak alternatives. Still include
`Recommended next action` and `Shortcut`; use `park/none` when there is genuinely
no useful next step.

## Approval Handling

If the user approves the review packet, do not rerun the planning loop unless
their approval changes scope. Route to the single `Recommended next action`.
Treat short replies such as `LGTM`, `approve`, `sounds good`, or `do it` as
approval for that action and preserve the packet's plan artifact, scope,
verification, user decisions, parked items, and stop condition.

If the user pushes back on part of the recommendation, treat that as new charter
input. Rerun only the affected scout stage, not the whole loop.
