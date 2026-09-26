# Output Shapes

Use these compact shapes for inline `intuitive-flow` responses. Use the files
in `../templates/` when creating durable artifacts:

- `../templates/route-brief.md`
- `../templates/pre-plan.md`
- `../templates/closeout.md`

Every shape follows one rule: include a field only when it carries information
for this run. Omit fields that would read `none`, `not applicable`, or restate
the default. Readers should see decisions, not an empty form.

## Upfront Route Brief

Return before the first non-trivial artifact or edit. For tiny direct work, one
sentence naming the path is enough.

```text
Selected path: <stage/skill sequence>
Why: <one sentence>
Bypassed: <stage - reason>                    (when heavier routing was plausible)
Execution surface: <main session | worker - benefit>  (when delegation is considered)
Commit rhythm: <auto-commit verified owned slices | blocked by ...>
Stop gate: <command/artifact that decides complete or blocked>
```

Add task control plane, project status role, or review cadence only when
ownership is shared or a worker runs. When the latest user intent is read-only
(see the shared First Gates), return a status/decision summary instead of a
route brief with implementation steps.

## Hot Resume

Use the experiment contract in
[context budget and loop guard](context-budget-and-loop-guard.md).

## Pre-Plan

Use `../templates/pre-plan.md`.

## Workflow Recommendation

```text
Current state: <fuzzy | draft-plan | reviewed-plan | gsd-phase | changed-code | refactor-goal>
Recommended next step: <skill/stage>
Why: <one sentence>
Stop condition: <what should be true before the next stage>
```

## Implementation Closeout

Use `../templates/closeout.md`.

After completed implementation or refactor work, the final response always
shows four categories so nothing is hidden in prose or logs: `What changed`,
`Proof`, `Scope changes`, and `Parked todos` (write `none` for an empty one of
these four). If a required product-run, live, or manual gate was skipped or
blocked, the proof claim level is `partial` or `blocked`, not complete.

## Repo Guidance Updates

When updating root agent guidance, update `AGENTS.md` and `CLAUDE.md` only,
unless the user asks for README or architecture changes.
