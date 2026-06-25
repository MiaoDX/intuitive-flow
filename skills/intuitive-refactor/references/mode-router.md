# Mode Router

Use this reference when `$intuitive-refactor` needs route selection, a scope
gate, severity classification, or a proof ladder before editing.

## Routes

`$intuitive-refactor` starts after a known target exists. Unknown-target
cleanup discovery, architecture deletion candidate finding, and repo-wide
ranking belong to `$intuitive-reduce-entropy`; use its selected-candidate
packet as this skill's discovery source.

| Route | Use when | Output | Redirect when |
| --- | --- | --- | --- |
| Gate | The user names a target, selects a reduce-entropy candidate packet, or the task is broad/risky/architecture-shaped enough to need accepted severities before edits. | Refactor scope, accepted checklist, evidence ladder, stop condition, parked items. | The user is asking what to clean next or wants deletion/merge candidates found. |
| Slice | The user names a bounded code/API/module seam and wants cleanup implemented. | One vertical slice with code, callers, tests, docs/stale surfaces, and proof. | The task lacks scope, non-goals, or verification. |
| Ratchet | The accepted target or candidate set needs repeated code-size, complexity, module-sprawl, stale-surface, or architecture simplification slices. | Gate plus quality signal, architecture pressure, behavior-change policy, simplification claim, and per-slice value metrics. | No target/candidate exists, or the next step is read-only candidate discovery. |
| Changed-code review | The request is post-implementation reuse/quality/efficiency review of changed files. | Diff-scoped findings first, optional targeted fixes only when authorized, then proof to rerun. | The issue is broader architecture cleanup or entropy discovery. |

Use the campaign overlay, not a separate route, when a ratchet is expected to
span many slices, workers, hours, commits, or resumed sessions. The overlay
adds an active capsule, checkpoint cadence, commit policy, and one of two
long-running loops from `references/ratchet-campaign.md`: a selected-slice loop
for accepted candidate packets, or a repo-wide maintenance goal loop when the
user explicitly asks for recurring whole-repo architecture cleanup that should
keep discovering and executing clear work until saturated.

For non-trivial runs, state:

```text
Selected route:
Why:
Redirect:
```

For tiny direct work, one sentence is enough. Add a final `Route note:` only
when the user manually invoked this skill, the request was ambiguous, or another
route/skill would fit better.

## Severity Guide

- P0: current behavior, data, safety, security, or public contract is broken or
  dangerously misleading.
- P1: live source drift, false confidence, stale reachable API, recurring
  rediscovery, or real workflow friction.
- P2: useful cleanup with bounded impact that supports an accepted P0/P1 slice
  or removes meaningful repeated maintenance cost.
- Parked: polish, speculative abstractions, broad reorganizations without a
  current surprise, unavailable proof, or ideas outside the accepted target.

## Scope Gate Shape

```text
Refactor scope:
Discovery source:
Target:
Accepted severities:
Accepted cleanup checklist:
Parked cross-seam / future ideas:
Evidence ladder:
Stop condition:
Execution risks:
Low-value stop signal:
```

For long-running ratchets that use the campaign overlay, also add:

```text
Current quality signal:
Architecture pressure:
Behavior-change policy:
Architecture simplification claim:
Surface metrics:
Discovery handoff trigger:
```

If the target is architecture-shaped or the module map is unclear, run the
architecture review sequence before execution: zoom out, engineering review,
then accepted refactor gate. Use `$improve-codebase-architecture` only as
optional extra report-only candidate discovery if that review sequence still
leaves no accepted target seam.

## Evidence Ladder

First inventory the repo's available verification layers from local docs,
scripts, package targets, CI, and existing test/harness guidance. For
long-running campaigns, record the inventory in the gate or active capsule so
future slices do not rediscover it.

Choose the smallest ladder that proves the accepted scope and change class:

- L0 static/search proof for docs, references, and stale-path cleanup.
- L1 unit/mock tests for local behavior.
- L2 contract/integration tests for public APIs, commands, or file formats.
- L3 product/demo/manual proof for UI, simulator, provider, hardware, or
  external-service behavior.

Use `../../_shared/references/durable-run.md` for the cross-skill proof selector.
Focused proof is preferred when it observes the changed behavior. Expensive
full-suite, visual, simulator, product, or manual gates are required only when
the accepted scope changes behavior those gates uniquely observe, focused proof
cannot cover the blast radius, or the gate file explicitly requires them.

Do not claim completion from narrower proof than the scope requires.

## Stop Conditions

Stop when the accepted checklist is complete, proof passes or a concrete
blocker is named, stale surfaces in scope are removed or explicitly parked, and
remaining findings are outside accepted severities.

Do not broaden into nearby cleanup just because it is visible. Park it with
enough evidence for a future selection decision.

Stop and discuss or route to `$intuitive-reduce-entropy` when the next
candidate cannot name a deletion, merge, canonical owner move, stale-surface
removal, or material maintainer surprise. With the campaign overlay, use
`references/ratchet-campaign.md` for the selected-slice or repo-wide
maintenance saturation rule.
