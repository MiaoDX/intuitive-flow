---
name: intuitive-refactor
description: |
  Refactor and cleanup router for known code/module/API seams, stale surfaces,
  compatibility shims, architecture cleanup targets, changed-code quality
  review, oversized modules, and repeated cleanup campaigns. Use this when the
  user names a concrete seam or wants code/package layout made smaller and
  truer. For unknown "what should we clean?" discovery, start with
  intuitive-reduce-entropy, then return here to execute selected candidates.
---

# Intuitive Refactor

Use `$intuitive-refactor` to make selected cleanup canonical: delete stale
surfaces, merge duplicate concepts, move behavior to the right owner, update
callers/tests/docs, and prove the behavior still holds.

This is a compact runtime router. Load only the reference needed for the
selected route.

## Route

| Need | Read |
| --- | --- |
| Mode selection, scope gate, severity guide, evidence ladder | `references/mode-router.md` |
| Repeated cleanup, oversized modules, stale surfaces, deletion/owner-move ratchets | `references/ratchet-mode.md` |
| Long-running or periodic cleanup campaign, active capsule, repeated discovery/execution loop | `references/ratchet-campaign.md` and `../_shared/references/durable-run.md` |
| Diff-scoped reuse/quality/efficiency review after implementation | `references/changed-code-review.md` |
| Full legacy guidance, templates, confidence ladder, command naming, persistent-state examples | `references/detailed-guidance.md` |

If multiple routes match, load the narrowest reference first and add the next
one only when the work crosses that boundary.

## Operating Rule

Start from a target and a stop condition, not from "make it cleaner."

- Known seam/module/API/stale surface: execute a bounded refactor slice.
- Unknown repo-wide cleanup: route to `$intuitive-reduce-entropy` first, then
  execute selected candidates here.
- Repeated cleanup or "keep going": run campaign mode, execute only clear
  P1/P2 slices, park uncertain decisions, then discover again until saturated.
- Changed-code cleanup: stay diff-scoped; report findings first and fix only
  when authorized by the user or approved flow.

Prefer the organized future at `HEAD` over compatibility shims. Preserve
compatibility only when an external contract, artifact reader, or explicit
migration requirement makes it necessary.

For every slice, prefer concept reduction over code motion:

1. Delete stale or unreachable surfaces.
2. Merge duplicate concepts, wrappers, registries, fixtures, or owners.
3. Move behavior to an existing canonical owner and update callers.
4. Create a new owner only when the architecture lacks a true home.
5. Extract helpers only around a named ownership boundary.

Reject slices that only make a file smaller, add vague modules, preserve stale
aliases indefinitely, or lack focused proof.

## Slice Loop

For non-trivial work, state:

```text
Selected mode:
Why:
Redirect:
```

Then run one vertical slice at a time:

1. Orient from the smallest context that can prove the target and owner.
2. Classify findings as P0, P1, P2, or Parked.
3. State the architecture claim and expected value metrics.
4. Update code, callers, tests, docs, and stale surfaces together.
5. Verify with the smallest sufficient evidence ladder.
6. Checkpoint what changed, what stayed parked, and what proof passed. In
   campaign mode, commit verified implementation slices by default; the
   detailed skip rules live in `references/ratchet-campaign.md`.

Stop when the accepted checklist is complete and remaining candidates are
parked, polish, public-contract migrations, or design decisions. In campaign
mode, stop only after the saturation rule in `references/ratchet-campaign.md`
is met.
