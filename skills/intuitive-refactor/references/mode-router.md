# Mode Router

Use this reference when `$intuitive-refactor` needs mode selection, a scope
gate, severity classification, or a proof ladder before editing.

## Modes

| Mode | Use when | Output | Redirect when |
| --- | --- | --- | --- |
| Scope gate | The target is broad, risky, architecture-shaped, or needs accepted severities before edits. | Refactor scope, accepted checklist, evidence ladder, stop condition, parked items. | The user is only asking what to clean next across the repo. |
| Execution slice | The user names a bounded code/API/module seam and wants cleanup implemented. | One vertical slice with code, callers, tests, docs/stale surfaces, and proof. | The task lacks scope, non-goals, or verification. |
| Entropy-backed cleanup intake | The user asks for repo cleanup or selects a candidate from `$intuitive-reduce-entropy`. | If no candidate exists: redirect to repo entropy discovery. If selected: refactor gate with deletion/merge-first plan, proof, and low-value stop rule. | A concrete seam is already named; use execution slice or ratchet mode. |
| Ratchet mode | The goal is repeated code-size, complexity, module-sprawl, stale-surface, or architecture simplification. | Scope gate plus quality signal, architecture pressure, behavior-change policy, simplification claim. | The request is only to review the current diff. |
| Architecture deletion audit | A ratchet has slowed into low-ROI slices, or the user wants unnecessary modules, stale architecture, deletion candidates, or merge candidates found before editing. | Ranked read-only deletion/merge candidates with owner layer, why unnecessary, blast radius, proof, and one recommended first slice. | A concrete seam is already approved for implementation. |
| Ratchet campaign | The user asks to continue cleanup for many slices/hours, run periodic automatic cleanup, or resume a gate with status `CONTINUE`. | Canonical gate plus active capsule, repeated discovery/execution batches, checkpoint cadence, per-slice proof selector, parked decisions. | Two consecutive discovery passes find no clear safe P1/P2 slice, or remaining candidates need human/public-contract decisions. |
| Changed-code review | The request is post-implementation reuse/quality/efficiency review of changed files. | Diff-scoped findings first, optional targeted fixes only when authorized, then proof to rerun. | The issue is broader architecture cleanup or entropy discovery. |

For non-trivial runs, state:

```text
Selected mode:
Why:
Redirect:
```

For tiny direct work, one sentence is enough. Add a final `Mode note:` only
when the user manually invoked this skill, the request was ambiguous, or another
mode/skill would fit better.

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

For long-running ratchets, also add:

```text
Current quality signal:
Architecture pressure:
Behavior-change policy:
Architecture simplification claim:
Surface metrics:
Deletion-audit trigger:
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

Stop and discuss when the next candidate cannot name a deletion, merge,
canonical owner move, stale-surface removal, or material maintainer surprise.
In campaign mode, use `references/ratchet-campaign.md` for the repeated
discovery saturation rule.
