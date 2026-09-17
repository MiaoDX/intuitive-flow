# Scout dispatch and judgment

Read when preparing independent planning workers.

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
