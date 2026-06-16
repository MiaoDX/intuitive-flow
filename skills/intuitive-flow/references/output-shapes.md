# Output Shapes

Use these compact shapes for inline `intuitive-flow` responses. Use the files
in `templates/` when creating durable artifacts:

- `templates/route-brief.md`
- `templates/pre-plan.md`
- `templates/closeout.md`

## Upfront Route Brief

Return before the first non-trivial artifact or edit:

```text
Current state: <classification>
Latest user intent: <execute | read-only/status | discuss-first | stop/pause>
Host goal state: <none | active | blocked | complete | unavailable>
Goal ownership: <adopt existing root | create root | no root goal | worker sub-goal only>
Selected path: <stage/skill sequence>
Why: <one sentence>
Bypassed/left behind: <stage - reason; stage - reason>
Execution surface: <read-only main session | main session direct with exception reason | Paseo subagent | skill-runner/tmux worker per sub-phase>
Babysitter cadence: <none | every N min based on task risk/proof duration>
Commit rhythm: <semantic commits enabled | disabled because ...>
Stop gate: <repo command/artifact deciding complete | blocked | continue, or "none">
Stop/continue point: <what happens before the next checkpoint>
```

For tiny direct work, one sentence is enough, but still name the selected path
when heavier routing was plausible.

When choosing main-session direct execution for durable work, include:

```text
Exception reason: <why this is tiny, bounded, and safe for main-session context>
Fallback worker route: <worker scope if it expands, loops, or needs long proof>
```

If the latest user intent is read-only, discuss-first, stop, or pause, use
`Execution surface: read-only main session` and do not include implementation
steps.

## Hot Resume Experiment Contract

Return before implementation in active-goal resume/debug turns:

```text
Context budget: <low | medium | high, plus reason if not low>
Latest user intent: <execute | read-only/status | discuss-first | stop/pause>
Host goal state: <none | active | blocked | complete | unavailable>
Goal ownership: <adopt existing root | create root | no root goal | worker sub-goal only>
Current blocker: <one sentence>
Hypothesis: <one falsifiable claim>
Expected decision delta: <what next decision changes if this succeeds/fails>
Command/artifact: <exact command or artifact summary path>
Success means: <observable outcome>
Failure means: <observable outcome and next stop/route>
No-touch scope: <files, subsystems, services, or workflows not touched>
```

If `Expected decision delta` is empty, continue read-only inspection only long
enough to form a decision-changing contract. Do not make an observability edit
that preserves the same next decision.

Do not emit an implementation contract when latest user intent or host goal
state says to stop. Emit a read-only status/decision summary instead.

## Pre-Plan

Use `templates/pre-plan.md`.

## Workflow Recommendation

```text
Current state: <fuzzy | draft-plan | reviewed-plan | gsd-phase | changed-code | refactor-goal>
Recommended next step: <skill/stage>
Why: <one sentence>
Stop condition: <what should be true before the next stage>
```

## Implementation Closeout

Use `templates/closeout.md`.

The final user-facing response after completed implementation/refactor work must
visibly enumerate `What changed`, `Proof`, `Scope changes`, and `Parked todos`.
Do not bury these categories inside prose, verification logs, commit messages,
worker handoffs, or "follow-ups available" language. If a category is empty,
print it with `none`. If any required product-run, local/live, or manual gate
was skipped or blocked, set the proof claim level to `partial` or `blocked`
instead of implying full completion.

## Repo Guidance Updates

When updating root agent guidance, update `AGENTS.md` and `CLAUDE.md` only. Do
not scatter workflow rules across README or architecture docs unless the user
asks.
