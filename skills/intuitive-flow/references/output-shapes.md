# Output Shapes

Use these compact shapes for `intuitive-flow` responses and artifacts. Prefer
the files in `templates/` when creating durable artifacts.

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
Execution surface: <read-only main session | main session direct with exception reason | Paseo-managed agent | skill-runner/tmux worker per sub-phase>
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

Write to:

```text
docs/plans/<slug>.md
```

Include:

- problem / goal
- idea-shaping mode: direct or auto-guided
- decisions already made
- idea shaping decisions table when auto-guided mode was used
- source evidence
- non-goals
- smallest demo
- fuller demo
- success criteria and acceptance criteria
- verification expectations
- proposed vertical slices
- risks and assumptions
- GSD handoff trigger:
  - existing phase -> `gsd-plan-phase <phase> --prd docs/plans/<slug>.md`
  - missing `.planning/` or missing roadmap phase -> create/use ingest manifest,
    run `gsd-ingest-docs --manifest <manifest>`, then
    `gsd-plan-phase <created-phase> --prd docs/plans/<slug>.md`

## Workflow Recommendation

```text
Current state: <fuzzy | draft-plan | reviewed-plan | gsd-phase | changed-code | refactor-goal>
Recommended next step: <skill/stage>
Why: <one sentence>
Stop condition: <what should be true before the next stage>
```

## Implementation Closeout

Include:

- what changed
- verification run and result
- documentation status check and any doc updates/moves/removals when code or
  refactor work changed human-facing truth
- semantic commit ids created, or why commits were disabled
- stop gate checked, with result when this was a durable auto-run
- goal ownership result: root goal adopted/created/not used, and any
  worker-local goals closed or blocked
- scope changes, always, including `none`; include accepted scope changes from
  `autoplan`, plan reconciliation, GSD handoff, refactor gates, or execution
  discoveries, and keep them separate from parked/deferred work
- `STATUS.md` check/update result for non-trivial durable runs
- Serena memory check/update result when Serena memories are configured, or
  `not configured/not available`
- parked todo triage: classification summary and whether one automatic
  parked-follow-up slice ran, was not applicable, or was skipped with reason
- parked todos, always, including `none found`
- verification explicitly not run
- worker handoff inspected when execution ran in tmux
- worker drift or timeout intervention, including revised goal, when one
  occurred

The final user-facing response after completed implementation/refactor work must
visibly enumerate `What changed`, `Scope changes`, and `Parked todos`. Do not
bury these categories inside prose, verification logs, commit messages, worker
handoffs, or "follow-ups available" language. If a category is empty, print it
with `none`.

## Repo Guidance Updates

When updating root agent guidance, update `AGENTS.md` and `CLAUDE.md` only. Do
not scatter workflow rules across README or architecture docs unless the user
asks.
