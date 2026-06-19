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

For each slice:

1. Pick the highest-value concrete seam from the existing gate or a short scout.
2. Prefer deletion, duplicate-concept merge, or moving callers to an existing owner.
3. State the architecture claim before editing.
4. Update code, tests, and the gate file together.
5. Verify with the smallest proof that covers the slice.
6. Commit if requested or repo workflow expects process commits.

Stop when the next candidate is only polish, needs a public migration decision,
lacks proof, or would split by size instead of ownership. Park it instead of
continuing.

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
