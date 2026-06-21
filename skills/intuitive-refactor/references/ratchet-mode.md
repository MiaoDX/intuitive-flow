# Ratchet Mode

Use this reference when `$intuitive-refactor` is running a codebase quality
ratchet: repeated slices over oversized modules, complexity rows, backend/report
sprawl, test setup debt, or architecture entropy.

## Core Rule

Prefer concept reduction over code motion.

Rank slice options in this order:

1. Delete stale or unreachable surfaces.
2. Merge duplicate concepts, APIs, fixtures, or builders.
3. Move behavior to an existing owner and update callers to that owner.
4. Create a new owner only when the architecture lacks a true home.
5. Extract helpers only around a named ownership boundary.

A line-count win is weak if it adds vague modules, preserves unnecessary facade
wrappers, or makes future agents rediscover the same concepts.

## Value Metrics

Every ratchet slice should state its net architecture value before editing and
report the value after proof. Use simple counters instead of prose alone:

- stale surfaces, wrappers, aliases, or legacy paths removed;
- duplicate concept owners merged;
- current callers migrated to a single canonical owner;
- tests or docs stopped preserving stale names;
- new modules, registries, or owners added;
- public contracts touched or explicitly preserved.

Creating a new owner is acceptable only when it removes more surprise than it
adds. If a proposed slice cannot improve at least one deletion, merge,
canonical-owner, or stale-surface metric, treat it as low value and stop for
discussion or route back to entropy discovery.

For over-engineering, bloat, YAGNI, or deletion-first refactor prompts, use
community `$ponytail-review` or `$ponytail-audit` as candidate discovery, then
apply this ratchet mode's severity, behavior-change, proof, and stop gates
before editing.

## Good Ratchet Slices

- Ownership splits: report section renderers, artifact envelopes, backend
  evidence packets, runtime-map contracts, stage objects, scenario factories.
- Concept consolidation: one canonical backend identity, one task catalog, one
  fixture builder vocabulary, one public/private evidence envelope.
- Stale surface removal: old command names, compatibility wrappers, dead
  aliases, legacy tests, duplicate docs.
- Test simplification: shared scenario builders and assertion vocabulary before
  file splitting.
- Line-count relief only when it follows one of the above.

Reject slices that only move private functions into a new file, preserve every
old alias indefinitely, couple tests to private wrappers, or make the plan
ledger longer than the code change is valuable.

## Architecture Deletion Audit

Use this read-only mode when a ratchet campaign is producing correct but slow
behavior-preserving hardening slices, or when the user explicitly wants to find
unnecessary architecture before doing more refactor work.

The audit goal is to find deletion or merge candidates that make the architecture
truer and smaller. It is not a repo-wide wish list and it does not edit code by
default.

Rank candidates in this order:

1. Stale public or private surfaces whose active replacements already exist.
2. Compatibility shims, aliases, wrappers, or legacy command paths with no
   current external contract.
3. Duplicate owners for the same domain concept, data envelope, fixture, route,
   report section, or runtime state.
4. Modules that exist only to preserve old names or pass through to another
   owner.
5. Tests that force stale surfaces to stay alive instead of proving current
   behavior.

Do not count pure extraction, formatting, line shuffling, or "could be nicer"
as deletion candidates. Park candidates that require a product/public-contract
decision, unavailable proof, paid services, credentials, hardware, or broad
migration approval.

Use this output shape:

```text
Architecture deletion audit:
Scope inspected:
Quality signal:
Surface metrics:
Ranked candidates:
- P1/P2/Parked: <surface/module/concept>
  Owner layer:
  Why unnecessary:
  Expected simplification:
  Behavior-change class:
  Blast radius:
  Proof:
  Stop/ask condition:
Recommended first slice:
Rejected/parked:
```

If the recommended first slice is accepted or already inside an approved gate,
continue with the normal architecture claim before editing. If not, stop after
the audit and ask for approval of the candidate, because deletion can change
public behavior or remove familiar but stale entrypoints.

## Behavior-Change Policy

Do not default to preserving all behavior perfectly. Classify the change:

- Public contract: CLI, API, artifact schema, report shape, user-facing docs,
  persisted data. Preserve unless the approved slice includes migration or
  removal and verifies callers.
- Internal contract: private helpers, compatibility aliases, test-only imports,
  legacy wrappers. Prefer migration and deletion when known in-repo callers can
  be updated.
- Behavior cleanup: unreachable branches, stale modes, duplicated fallback
  policy, misleading docs/tests. Remove or simplify when evidence shows the old
  behavior is not part of the desired architecture.

Stop for a scope decision if public behavior changes and the approved plan did
not already include that change.

## Architecture Claim

Before implementation, write:

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

Good claims name the owner and reduced concept, for example:

- "Move report-only semantic-map artifact rendering out of the main report
  renderer so report.py no longer owns map artifact construction."
- "Replace two backend identity envelopes with the existing backend facade and
  delete the duplicate local wrapper."
- "Turn repeated behavior-test setup into a scenario factory, then update tests
  to speak in domain terms."

Weak claims are "move 200 lines to helpers", "make file smaller", or "keep old
imports with aliases because tests use them."

## Autonomous Ratchet Runs

When the user asks for continuous cleanup, run repeated ratchet slices, not an
open-ended refactor.

For long-lived or resumed campaigns, read `references/ratchet-campaign.md` and
`../../_shared/references/durable-run.md`. Those shared rules own the active
capsule, checkpoint cadence, control-plane/worker shape, and proof selector.

If the user asks for periodic architecture cleanup but no concrete seam,
accepted gate, or selected entropy candidate exists, run
`$intuitive-reduce-entropy` first. This mode executes selected cleanup; it does
not replace repo-wide candidate discovery.

For each slice:

1. Pick the highest-value concrete seam from the existing gate or a short scout.
2. Prefer deletion, duplicate-concept merge, or moving callers to an existing owner.
3. State the architecture claim before editing.
4. State the value metrics that should improve.
5. Update code, tests, and the gate file together.
6. Verify with the smallest proof that covers the slice.
7. Commit if requested or repo workflow expects process commits.

Stop when the next candidate is only polish, needs a public migration decision,
lacks proof, would split by size instead of ownership, or cannot improve a net
surface metric. If two consecutive candidate-selection attempts produce only
low-impact hardening, line motion, or "could be nicer" work, stop and return a
discussion packet instead of continuing.

## Lessons From Prior Ratchets

Effective:

- A repo-local quality signal creates useful pressure.
- Small verified commits work well in multi-agent checkouts.
- Compact active-plan plus completed-ledger docs prevent rediscovery.
- Focused tests beat full-suite reflexes when the slice has a clear contract.

Ineffective:

- Pure line-count chasing can leave a large facade plus private aliases.
- Keeping every wrapper for compatibility turns extraction into concept
  multiplication.
- Splitting tests by line count misses duplicated setup vocabulary.
- Re-reading all orientation docs on every resume wastes time; prefer hot
  resume from status, recent commits, active plan, and ratchet summary.
