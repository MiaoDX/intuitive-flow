---
name: architecture-ratchet-refactor
description: |
  Use for long-running codebase entropy work where the user wants to reduce
  oversized modules, complexity, backend/report/test sprawl, or repeated
  refactor debt while making architecture simpler and more intuitive. Trigger
  when the user mentions ratchets, hard-ceiling files, code-size cleanup,
  architecture simplification, entropy reduction through refactors, repeated
  slice-based cleanup, or wants a workflow that combines line-count reduction
  with deleting stale surfaces and reducing concepts. This skill complements
  intuitive-refactor: use it when the goal is not just a bounded refactor, but
  a ratcheted sequence of architecture-improving slices.
---

# Architecture Ratchet Refactor

Use this skill to run a codebase quality ratchet where every slice must improve
architecture clarity, not only make a file shorter. It works best for repeated
cleanup over days: large modules, backend/report sprawl, stale compatibility
surfaces, overgrown tests, and helper extraction loops that can otherwise become
mechanical.

For a bounded one-off refactor, use `$intuitive-refactor`. For unknown cleanup
targets, use `$intuitive-reduce-entropy` first. Use this skill when there is
already a ratchet-shaped objective, plan, or recurring pain around codebase
architecture.

Read `references/refactor-lessons.md` when the agent needs concrete examples of
effective and ineffective slice patterns from prior ratchet work.

## Core Rule

Prefer concept reduction over code motion.

The default ranking for a slice is:

1. Delete stale or unreachable surfaces.
2. Merge duplicate concepts, APIs, fixtures, or builders.
3. Move behavior to an existing owner and update callers to that owner.
4. Create a new owner only when the architecture lacks a true home.
5. Extract helpers as a last resort, and only around a named ownership boundary.

Do not treat line count as the final goal. A line-count win is weak if it adds a
new module with vague ownership, preserves unnecessary facade wrappers, or
makes future agents rediscover the same concepts.

## Start Gate

Before editing, establish this packet:

```text
Architecture ratchet:
Target repo/plan:
Current quality signal:
Architecture pressure:
Accepted slice types:
Behavior-change policy:
Evidence ladder:
Stop condition:
```

Use the repo's existing source of truth if one exists: a plan file, ADR,
quality ratchet script, status file, or issue. Do not create a second active
plan for the same cleanup stream.

If the current user asks only for discussion or a skill design, stay read-only.
If they approve execution, work one vertical slice at a time.

## Slice Selection

Choose slices that reduce future branching or rediscovery:

- ownership boundary splits: report section renderers, artifact envelopes,
  backend evidence packets, runtime-map contracts, stage objects, scenario
  factories;
- concept consolidation: one canonical backend identity, one task catalog, one
  fixture builder vocabulary, one public/private evidence envelope;
- stale surface removal: old command names, compatibility wrappers, dead aliases,
  legacy tests, duplicate docs;
- test simplification: shared scenario builders and assertion vocabulary before
  file splitting;
- line-count relief only when it follows one of the above.

Reject slices that only:

- move private functions into a new file with no stronger owner;
- preserve every old alias indefinitely;
- update tests to depend on implementation-private wrappers;
- split tests by line count while leaving setup vocabulary duplicated;
- make the plan ledger longer than the code change is valuable.

## Behavior-Change Policy

Do not default to preserving behavior perfectly. Instead classify the change:

- Public contract: CLI, API, artifact schema, report shape, user-facing docs,
  persisted data. Preserve unless the slice explicitly proposes a migration or
  removal and verifies callers.
- Internal contract: private helpers, compatibility aliases, test-only imports,
  legacy wrappers. Prefer migration and deletion when known in-repo callers can
  be updated.
- Behavior cleanup: unreachable branches, stale modes, duplicated fallback
  policy, misleading docs/tests. Remove or simplify when evidence shows the old
  behavior is not part of the desired architecture.

If the slice changes public behavior, stop for a scope decision unless the
approved plan already includes that change.

## Execution Loop

1. Refresh current state:
   inspect `git status`, recent commits, the active plan, and the repo's quality
   signal. Do not rely on stale line counts.
2. Name the architecture claim:
   state which concept, owner, branch family, or compatibility surface will be
   simplified.
3. Pick one vertical slice:
   include code, callers, tests, docs/plan ledger, and stale wrapper deletion
   when they belong together.
4. Verify proportionally:
   run static checks, focused tests, and the quality ratchet. Use product/demo
   proof only for claims that require runtime behavior.
5. Record compact evidence:
   update the active plan or ledger with metric delta, architecture effect, and
   proof class. Do not paste logs.
6. Commit when appropriate:
   make semantic commits for verified slices; stage only owned files.
7. Stop or continue:
   continue only if the user authorized ongoing execution. Otherwise stop after
   the current verified slice.

## Architecture Claim Template

Use this before implementation:

```text
Slice:
Owner layer:
Current friction:
Simplification:
Behavior-change class:
Files likely touched:
Proof:
Non-goals:
```

Good claims:

- "Move report-only semantic-map artifact rendering out of the main report
  renderer so report.py no longer owns map artifact construction."
- "Replace two backend identity envelopes with the existing backend facade and
  delete the duplicate local wrapper."
- "Turn repeated behavior-test setup into a scenario factory, then update tests
  to speak in domain terms."

Weak claims:

- "Move 200 lines to helpers."
- "Make file smaller."
- "Keep old imports with aliases because tests use them."

## Evidence

Use the smallest evidence ladder that proves the claim:

- Static/search: deleted symbols, caller migration, no stale references.
- Unit/mock: behavior inside a module or fixture builder.
- Contract/integration: public APIs, command grammar, artifacts, reports, or
  schema shape.
- Product/manual: rendering, simulator, provider, hardware, or browser behavior.

Always run the repo's quality ratchet before selecting a slice and again before
closing it when a ratchet exists.

## Closeout

Report:

- what architecture got simpler;
- line/complexity deltas, if relevant;
- behavior changes or preserved public contracts;
- verification commands;
- parked follow-ups.

Do not mark a multi-slice ratchet objective complete just because the latest
slice passed. Completion requires the plan's stop condition to be audited
against current evidence.
