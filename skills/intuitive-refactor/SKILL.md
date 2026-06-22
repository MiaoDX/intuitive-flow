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

This is a compact runtime router for mutation work. `$intuitive-reduce-entropy`
owns unknown-target discovery and cleanup candidate ranking; return here only
after the user names a target or selects a candidate packet.

## Route

| Need | Read |
| --- | --- |
| Route selection, scope gate, severity guide, evidence ladder | `references/mode-router.md` |
| Repeated cleanup, oversized modules, stale surfaces, deletion/owner-move ratchets | `references/ratchet-mode.md` |
| Long-running ratchet overlay, active capsule, repeated selected-slice loop | `references/ratchet-campaign.md` and `../_shared/references/durable-run.md` |
| Diff-scoped reuse/quality/efficiency review after implementation | `references/changed-code-review.md` |
| Full legacy guidance, templates, confidence ladder, command naming, persistent-state examples | `references/detailed-guidance.md` |

If multiple routes match, load the narrowest reference first and add the next
one only when the work crosses that boundary.

## Operating Rule

Start from a target and a stop condition, not from "make it cleaner."

- Known seam/module/API/stale surface: gate or execute a bounded refactor slice.
- Unknown repo-wide cleanup or deletion/merge discovery: route to
  `$intuitive-reduce-entropy` first. Use its selected-candidate packet as this
  skill's discovery source.
- Repeated cleanup or "keep going": run ratchet route, add the campaign overlay
  only for long-lived/resumed work, execute only selected clear P1/P2 slices,
  and park uncertain decisions.
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
Selected route:
Why:
Redirect:
```

Then run one vertical slice at a time:

1. Orient from the smallest context that can prove the target and owner.
2. Classify findings as P0, P1, P2, or Parked.
3. State the architecture claim and expected value metrics.
4. Update code, callers, tests, docs, and stale surfaces together.
5. Verify with the smallest sufficient evidence ladder.
6. Checkpoint what changed, what stayed parked, and what proof passed. With the
   campaign overlay, commit verified implementation slices by default; the
   detailed skip rules live in `references/ratchet-campaign.md`.

Stop when the accepted checklist is complete and remaining candidates are
parked, polish, public-contract migrations, or design decisions. With the
campaign overlay, stop only after the selected-slice saturation rule in
`references/ratchet-campaign.md` is met.
