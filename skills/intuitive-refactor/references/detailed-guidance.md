# Intuitive Refactor: Detailed Guidance

Set the goal, scope, evidence, and stop condition for a bounded refactor before
code changes start. Once a target slice is accepted, clean it up aggressively:
move callers to the new API, layout, or module boundary and remove stale
compatibility surfaces.

This workflow owns the scope gate and stop condition. Architecture scanners,
TDD, diagnosis, or planning skills are optional inputs when they raise evidence
quality; the accepted checklist and stop condition stay here.

## Operating Rule

Start refactors from pressure, not possibility: current breakage, repeated
friction, an active task blocked by stale structure, source-of-truth drift,
false-green verification, or a user-named bounded target. "This could be
cleaner" stays parked until it blocks work or the user scopes it, because every
healthy project always has more possible refactors.

- Broad or ambiguous request: audit and stop at a decision-complete proposal.
- Named target plus a request to execute: that is approval to clean the target
  up aggressively, one vertical slice at a time.
- Repo-wide or periodic cleanup with no selected seam: route to
  `$intuitive-reduce-entropy` first.

Before editing production code, make explicit: the target seam, the accepted
checklist, severities in scope (default P0/P1/P2 inside the target), the
required proof, the stop condition, and the persistent gate file when this is
more than advice. The goal is a green accepted checklist with the new shape
canonical, not "no more possible refactors."

## Architecture Packet

Refactors that touch architecture seams, public APIs or contracts,
task/skill/profile boundaries, MCP/tool surfaces, lifecycle gates, data flow,
or runtime behavior need an architecture packet before production edits: either
this turn's `$codebase-design` map plus `$plan-eng-review` findings, or an
existing plan, ADR, or gate with equivalent evidence. If the interactive review
is unavailable, apply the same frame in prose and note the limitation. If no
seam is accepted afterwards, `$improve-codebase-architecture` can add
report-only candidates.

The packet covers the design map, review recommendation, public boundary, data
flow, accepted seam, rejected alternatives, verification ladder, and stop
condition.

## Canonical Cleanup Rule

In an approved slice, old surfaces are migration targets, not contracts. Update
in-repo callers, docs, tests, examples, CI, and command references to the new
shape, then delete old wrappers, aliases, import paths, dead branches, and shims.
Keeping a surface merely because it exists is not an architecture choice.

A user-requested temporary migration bridge is a tactical exception with a
recorded removal trigger. When broad command, install, or user-facing surfaces
are affected, propose the forward migration instead of defaulting to a
compatibility layer. In a full autonomous run, pause before local-only,
paid-provider, Docker/Gateway, or human-judgment gates unless explicitly
authorized.

## Persistent Gate

Chat history and agent memory are not reliable stop conditions across runs, so
persist the gate in the repo for execution, repeated runs, or "all big known
issues." Use [plan selection](../../_shared/references/plan-paths.md) for one
canonical gate (recommended `docs/plans/MM-DD-refactor-<target-slug>.md`). For
durable runs, also keep the active capsule from
[durable run](../../_shared/references/durable-run.md); the gate stays
canonical. When the gate lives under `docs/plans/`, keep its `## Plan Ledger`
and any `docs/plans/README.md` row current, and leave other plans' ledgers
alone.

Status appears in YAML frontmatter and in `## Status`:

- `DONE`: accepted checklist complete and evidence green. Stop; P2 polish stays
  parked unless the user reopens that exact slice.
- `CONTINUE`: an accepted item remains; continue it.
- `REOPEN`: the user widened scope or new evidence (including a repeated real
  failure) shows a P0/P1 regression; update the same gate.
- `PARK`: only cross-seam or future ideas remain; record them and stop.

On a repeated run, read the gate first and act on its status.

```markdown
---
refactor_scope: <target-slug>
status: CONTINUE
accepted_severities: [P0, P1, P2]
last_verified: null
---

# Refactor Scope: <target>

## Plan Ledger
## Status
## Target
## Accepted Cleanup Checklist
## Parked Cross-Seam / Future Ideas
## Evidence Ladder
## Stop Condition
## Execution Log
```

## Severity Gate

| Severity | Meaning | Default action |
| --- | --- | --- |
| P0 | Current breakage, data loss, security exposure, deploy failure, or a verifier that is green on real failure | Fix now |
| P1 | Correctness, source-of-truth, testability, or code-intelligence gap that can hide failure in the seam | Fix now |
| P2 | Duplication, naming, drift risk, stale API, or shim inside the accepted target | Fix when it simplifies the target |
| Parked | Speculative, cross-seam, taste, or future-proofing | Record only |

"All big known issues" means P0/P1 plus target-local P2 that removes stale
surfaces. Once implementation starts, new findings join the checklist only when
they are inside the target and directly support the canonical shape.

## Proof

Use the [shared proof selector](../../_shared/references/durable-run.md#proof-selector)
and inventory the repo's verification layers first for non-trivial work.
Record the command or manual procedure, observed behavior, success condition,
and missing runtime evidence. Run full-suite, visual, simulator, browser,
hardware, or manual gates only when they uniquely observe what the slice can
regress. Prefer the repo's existing verification command names.

## Workflow

1. **Orient.** Identify the target and seam, the change shape (bug/perf,
   architecture, cleanup, feature), behavior that must not regress, old surfaces
   to remove, minimum proof, and whether evidence is local-only or slow. Read
   repo agent docs and orientation docs before making claims, and look for an
   existing gate (`docs/plans/*refactor*.md`, a named plan, or a committed GSD
   phase). If the seam is still unclear, stop at a report-only map.
2. **Check tooling.** Before risky symbol-level edits, confirm the target
   language's LSP signals work from repo evidence. Missing repo-local setup goes
   through `$intuitive-init`; unsafe or global-only setup is recorded as missing
   evidence and narrows the proof claim.
3. **Pick helpers only when they help.** Unclear seam: `$codebase-design` plus
   `$plan-eng-review`. Missing behavior coverage: TDD one public-interface proof
   first. Bug, flake, or perf regression: diagnose a reproducible loop first.
   Docs layout goes to `$intuitive-doc`, test layout to `$intuitive-tests`,
   mixed repo surfaces to `$intuitive-reduce-entropy`. Doing the work inline is
   fine when it meets the same evidence and stop condition.
4. **Present the scope gate.** Target, change type, accepted severities and
   checklist, parked issues, compatibility removed (and any kept, with its
   trigger), required proof, existing and missing evidence, architecture packet
   when required, local-only gates, gate file, and a stop condition concrete
   enough to stop while more cleanup is imaginable, for example "accepted items
   pass `npm run test:publish-rules` and old APIs are removed" or "stop before
   implementation because the next proof needs real Gateway access." Write the
   gate file before editing when implementation is approved.
5. **Execute one vertical slice.** Add or identify the proof (watch new
   coverage fail), apply the smallest coherent cleanup, run the required proof,
   and summarize evidence and residual risk. Split multi-seam changes or park
   the extra seams.
6. **Close the loop.** Every accepted item has a change or a "no change
   needed" reason; every required proof has output or a stated skip; parked
   items are recorded, not implemented; old surfaces are gone or have a removal
   trigger. Update the gate's checklist, evidence, skipped gates, parked ideas,
   and status.

## Reporting

When only advising, do not edit files. Return the proposed proof gates, current
gate status if one exists, severity threshold, stop condition, whether to create
or update a gate, and the next optional skill.

After action, report changed files, gate path and status, checklist status,
parked issues, proof run and skipped with reasons, and whether the result is
ready for agent pickup, human review, or local validation.
