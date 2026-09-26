# Canonical Plan Selection

Use this rule whenever a skill creates, consumes, or moves an execution plan.

1. Reuse the user-selected or existing canonical plan for the same work. Keep
   its path, including an issue or a GSD-owned plan when that already owns scope.
2. For a new plan, follow explicit repository guidance, then the conventions of
   nearby active plans. Existing paths and lifecycle layouts are valid and stay
   as they are; Intuitive defaults apply only to new plans.
3. If no convention exists, recommend `docs/plans/MM-DD-<slug>.md`, using the
   creation date in the user's timezone, for example `docs/plans/09-21-skill-handoff.md`.
   Prefer a date prefix when local examples are mixed or naming is otherwise
   unconstrained. Use `YYYY-MM-DD` if the repo does so or the year is needed to
   distinguish plans. Extend the descriptive slug to avoid a name collision.

State the selected path and proceed within existing authorization. Routine
naming needs no approval; one piece of work has one plan; old plans keep their
names. Keep the creation date stable on updates.

When adopting the default layout, keep plans flat and lifecycle in the existing
status/ledger fields. Preserve an existing dashboard; create one only when a
multi-plan navigation need justifies it. Task resume state follows
[durable run](durable-run.md), independently of the plan's filename.

Pass the selected canonical source through review, preflight, execution, and
closeout. Paths such as `docs/plans/<slug>.md` in examples are placeholders,
not a requirement to migrate the target repository.
