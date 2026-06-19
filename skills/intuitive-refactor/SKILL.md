---
name: intuitive-refactor
description: Set a bounded aggressive refactor or changed-code cleanup goal before architecture or cleanup work starts, including checking target-repo LSP setup before risky symbol-level edits. Use whenever the user wants to improve architecture, clean up aggressively, review changed code for reuse/quality/efficiency, "fix all big issues", avoid endless refactors, decide what is in/out of scope, classify P0/P1/P2/Parked findings, remove stale APIs or compatibility shims, define tests and stop conditions, or run a long code-size/complexity ratchet that should simplify architecture instead of merely moving lines. Also use for continuous cleanup, keep improving this repo, and ongoing refactor ratchet prompts. This skill works standalone and can also be combined with architecture scanners, intuitive-flow, TDD, or diagnosis skills.
---

# Intuitive Refactor

Use this skill to turn architecture or cleanup intent into a bounded refactor
before code changes start. It can discover candidates, define accepted
severities, execute selected slices, and stop without becoming an endless
cleanup loop.

This compact entrypoint preserves full original guidance in
`references/detailed-guidance.md`. Read that file for detailed severity gates,
confidence ladder, prompt shapes, command naming, persistent state templates,
or completion summaries.

Read `references/ratchet-mode.md` when the request is a repeated code-size,
complexity, oversized-module, backend/report/test-sprawl, or entropy ratchet.
That mode tightens the normal refactor loop around concept reduction rather
than pure extraction.

Read `references/ratchet-campaign.md` plus
`../_shared/references/durable-run.md` when the user asks to keep refactoring,
continue cleanup, run a long-lived campaign, or resume an existing refactor
gate whose status is `CONTINUE`.

Read `references/changed-code-review.md` when the request is diff-scoped
cleanup, post-implementation review, reuse/quality/efficiency review, or when
`$intuitive-flow` asks for changed-code cleanup before final verification.

## Modes

| Mode | Use when | Output | Redirect when |
| --- | --- | --- | --- |
| Scope gate | The target is broad, risky, architecture-shaped, or needs accepted severities before edits. | Refactor scope, accepted checklist, evidence ladder, stop condition, parked items. | The user is only asking what to clean next across the repo. |
| Execution slice | The user names a bounded code/API/module seam and wants cleanup implemented. | One vertical slice with code, callers, tests, docs/stale surfaces, and proof. | The task lacks scope, non-goals, or verification. |
| Ratchet mode | The goal is repeated code-size, complexity, module-sprawl, or architecture simplification. | Scope gate plus quality signal, architecture pressure, behavior-change policy, simplification claim. | The request is only to review the current diff. |
| Ratchet campaign | The user asks to continue cleanup for many slices/hours or an existing refactor gate is `CONTINUE`. | Canonical gate plus active capsule, checkpoint cadence, per-slice proof selector, parked decisions. | The next candidate is only polish, lacks proof, or needs a public migration/user decision. |
| Changed-code review | The request is post-implementation reuse/quality/efficiency review of changed files. | Diff-scoped findings first, optional targeted fixes only when authorized, then proof to rerun. | The issue is a broader architecture cleanup or entropy discovery task. |

For non-trivial runs, state `Selected mode:`, `Why:`, and `Redirect:` before
the first artifact or edit. For tiny direct work, one sentence can carry the
same information. Add a final `Mode note:` only when the user manually invoked
this skill, the request was ambiguous, or another mode/skill would fit better.

## Operating Rule

Start from a target and a stop condition, not from "make it cleaner." When the
target is broad, first produce a refactor scope gate. When the user names a
bounded target and asks for execution, treat that as approval to implement
inside the accepted gate.

Prefer the organized future at `HEAD` over compatibility shims. Preserve
compatibility only when the user explicitly asks for a migration bridge or an
external contract requires it.

For ratchet-shaped work, prefer concept reduction over code motion: delete
stale surfaces, merge duplicate concepts, move callers to an existing owner,
and create a new module only when the architecture lacks a true home. Line-count
relief is useful evidence, not the goal.

For changed-code review, stay diff-scoped. Review the changed files through the
reuse, quality, and efficiency lenses, report findings first, and fix only when
the user or approved flow has clearly authorized an implementation pass.

## Default Workflow

1. Orient:
   read current docs, module owners, call sites, tests, and existing gates just
   enough to understand the target.
2. Classify findings:
   P0, P1, P2, or Parked. Reject polish-only work and speculative refactors.
3. Define the scope gate:
   target, accepted severities, checklist, parked items, evidence ladder, stop
   condition, and execution risks.
4. Execute one vertical slice at a time:
   update code, callers, tests, docs, and stale surfaces together.
5. Verify:
   run the evidence ladder appropriate to the blast radius.
6. Close:
   report what changed, what stayed parked, and what proof supports completion.

## Severity Guide

- P0: current behavior, data, safety, security, or public contract is broken or
  dangerously misleading.
- P1: live source drift, false confidence, stale reachable API, recurring
  rediscovery, or real workflow friction.
- P2: useful cleanup with bounded impact that supports an accepted P0/P1 slice
  or removes a meaningful repeated maintenance cost.
- Parked: polish, speculative abstractions, broad reorganizations without a
  current surprise, or ideas outside the accepted target.

## Evidence Ladder

First inventory the target repo's available verification layers from local docs,
scripts, Make targets, package scripts, CI, and existing test/harness guidance.
For long-running campaigns, record that inventory in the gate or active capsule
so future slices do not rediscover it.

Choose the smallest ladder that proves the accepted scope and change class:

- L0 static/search proof for docs, references, and stale-path cleanup;
- L1 unit/mock tests for local behavior;
- L2 contract/integration tests for public APIs, commands, or file formats;
- L3 product/demo/manual proof for UI, simulator, provider, hardware, or
  external-service behavior.

Use `../_shared/references/durable-run.md` for the cross-skill proof selector.
Focused proof is preferred when it observes the changed behavior. Expensive
full-suite, visual, simulator, product, or manual gates are required when the
accepted scope changes behavior those gates uniquely observe, when focused
proof cannot cover the blast radius, or when the gate file explicitly requires
them.

Do not claim completion from a narrower proof than the scope requires.

## Scope Gate Shape

```text
Refactor scope:
Target:
Accepted severities:
Accepted cleanup checklist:
Parked cross-seam / future ideas:
Evidence ladder:
Stop condition:
Execution risks:
```

If the target is architecture-shaped or the module map is unclear, run the
architecture review sequence before execution: zoom out, engineering review,
then accepted refactor gate. Use `$improve-codebase-architecture` only as
optional extra report-only candidate discovery if that review sequence still
leaves no accepted target seam.

For long-running ratchets, add these fields to the scope gate:

```text
Current quality signal:
Architecture pressure:
Behavior-change policy:
Architecture simplification claim:
```

## Stop Conditions

Stop when the accepted checklist is complete, the evidence ladder passes or a
concrete blocker is named, stale surfaces in scope are removed or explicitly
parked, and remaining findings are outside the accepted severities.

Do not broaden into newly discovered cleanup just because it is nearby. Park it
with enough evidence for a future selection decision.
