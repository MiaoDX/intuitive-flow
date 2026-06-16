---
name: intuitive-refactor
description: Set a bounded aggressive refactor goal before architecture or cleanup work starts, including checking target-repo LSP setup before risky symbol-level edits. Use whenever the user wants to improve architecture, clean up aggressively, "fix all big issues", avoid endless refactors, decide what is in/out of scope, classify P0/P1/P2/Parked findings, remove stale APIs or compatibility shims, define tests and stop conditions, or run a long code-size/complexity ratchet that should simplify architecture instead of merely moving lines. This skill works standalone and can also be combined with architecture scanners, intuitive-flow, TDD, or diagnosis skills.
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

Choose the smallest ladder that proves the accepted scope:

- L0 static/search proof for docs, references, and stale-path cleanup;
- L1 unit/mock tests for local behavior;
- L2 contract/integration tests for public APIs, commands, or file formats;
- L3 product/demo/manual proof for UI, simulator, provider, hardware, or
  external-service behavior.

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
