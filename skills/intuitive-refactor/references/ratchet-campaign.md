# Ratchet Campaign

Use this reference when a refactor ratchet is expected to run across many
slices, many workers, or many hours. A campaign is allowed to be long-lived, but
it is not open-ended: every slice still needs an owner-backed simplification
claim, focused proof, checkpoint, and stop condition.

Read `../../_shared/references/durable-run.md` before starting or resuming a
campaign. The shared file owns latest-user-intent gates, active capsules,
checkpoint cadence, control-plane/worker shape, context budget, and proof
selection.

## Campaign Entry

Enter campaign mode only when one of these is true:

- the user explicitly asks to keep refactoring, keep cleaning, continue a
  ratchet, or run a long cleanup campaign;
- an existing refactor gate has status `CONTINUE` and the latest user message
  asks to continue or keep going;
- the accepted objective is a code-size, complexity, stale-surface,
  compatibility, test-sprawl, or architecture-quality ratchet with multiple
  known slices.

Do not enter campaign mode for a vague "make it better" prompt without a gate.
Use scope gate or `$intuitive-reduce-entropy` first. For periodic architecture
cleanup where the user has not named a seam, run `$intuitive-reduce-entropy` in
repo entropy or discovery-loop mode and enter this campaign only after a
candidate packet, selected code/API/module target, or refactor gate exists.

## State Surfaces

Use two state surfaces:

- Canonical gate: `docs/plans/refactor-<target>.md` or the existing plan/gate.
  It owns scope, accepted severities, checklist, status, stop condition,
  verification inventory, parked items, and final evidence.
- Active capsule: `docs/status/active/<gate-slug>.md`. If
  `docs/status/active/` does not exist, create it. It owns the current slice,
  recent checkpoint, next proof, blocker fingerprint, and resume hint.

Do not create a second canonical plan for the same seam. Do not use chat
history, commit history, or temporary logs as the campaign handoff source.

## Campaign Gate Additions

Add these fields or sections to the normal refactor gate when a campaign starts:

```text
Campaign mode: true
Current quality signal:
Architecture pressure:
Verification inventory:
Checkpoint cadence:
Active capsule:
Continue criteria:
Stop/park criteria:
Discovery source:
Surface metrics:
Low-value stop signal:
```

The quality signal can be line count, duplicated concepts, stale API count,
test fixture duplication, dependency surface, or another repo-local metric. It
is pressure, not the goal. The goal remains concept reduction and ownership
clarity.

## Slice Selection

For each slice, prefer:

1. Delete stale or unreachable surfaces.
2. Merge duplicate concepts, constants, builders, fixtures, or wrappers.
3. Move behavior to an existing owner and update callers to that owner.
4. Create a new owner only when the architecture lacks a true home and the gate
   accepts that boundary.
5. Extract helpers only around a named ownership boundary.

Before editing, write a compact architecture claim:

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

Reject a slice when the claim is "make the file smaller" without a reduced
concept, canonical owner, or stale surface deletion.

If the current campaign has no concrete next seam, do not continue by browsing
for arbitrary local cleanup. Return to `$intuitive-reduce-entropy` for ranked
candidate discovery, then resume only after the user selects the code/API/module
cleanup candidate or approves the packet's recommended refactor action.

Run an architecture-deletion audit from `ratchet-mode.md` before choosing the
next implementation slice when any of these are true:

- the user asks to find unnecessary modules, stale architecture, deletion
  candidates, or a faster way to reduce code/architecture surface;
- the campaign has produced several small behavior-preserving hardening slices
  and the next candidate is not clearly higher value;
- the active plan's candidate list is mostly fallback/source validation, but
  the campaign goal or user feedback has shifted toward architecture cleanup
  and code reduction;
- repeated scouts return only polish or low-impact local seams.

The audit is read-only unless the user already approved executing the
recommended candidate. Its output should pick one recommended first slice and
park the rest; do not turn it into a second long-lived plan.

Record these value metrics for each committed slice and in the closeout:
surfaces deleted, duplicate owners merged, wrappers/aliases removed, callers
migrated to one owner, tests/docs updated away from stale names, new owners
added, and public contracts touched or preserved.

## Verification

At campaign start, inventory the repo's proof layers once and record them in
the gate or capsule. For each slice, choose the smallest proof that covers the
change class using `../../_shared/references/durable-run.md`.

Do not run the full suite after every small slice by reflex. Do run broader,
slower, visual, simulator, browser, product, or manual gates when the slice
changes the behavior those gates uniquely observe, touches a public contract,
or crosses broad infrastructure.

When skipping a costly gate, state:

```text
Skipped <gate>: <slice change class> did not alter <behavior/artifact/contract>;
focused proof covered <observable risk>; residual risk is <...>.
```

## Checkpoint Rhythm

Checkpoint after every committed slice and at least every 60-120 minutes during
a long campaign. The checkpoint should update:

- active capsule with current status, last proof, next slice/proof, and parked
  work;
- canonical gate when accepted checklist, verification inventory, stop
  condition, campaign status, or final evidence changes;
- semantic commit if the repo/user workflow expects per-slice commits.

Use batch summaries in the canonical gate. Do not append command transcripts or
long per-slice prose that makes the plan harder to resume than the code.

## Continue Criteria

Continue only while the next slice is:

- inside the accepted target/gate;
- backed by an existing owner or accepted new owner;
- expected to delete, merge, or canonicalize a real concept;
- expected to improve at least one net surface metric;
- verifiable with available proof;
- not blocked by external input or a public migration decision.

Park, stop, or ask when:

- the next candidate is only polish or taste;
- the next move would change public API/CLI/schema/artifacts without accepted
  migration scope;
- the proof needed for honesty is unavailable or external;
- scout workers repeatedly return `park` for the same area;
- the campaign is growing the plan faster than it simplifies the code;
- two consecutive candidate-selection attempts cannot name a deletion, merge,
  canonical owner move, stale-surface removal, or material maintainer surprise;
- an architecture-deletion audit recommends only public removals that need a
  human migration decision;
- the latest user message asks for status, discussion, pause, or process
  review rather than execution.

## Campaign Closeout

Close a campaign when the accepted checklist is complete, the gate status is
`DONE` or `PARK`, and required proof is green or honestly blocked. Report:

- canonical gate path and status;
- active capsule path and whether it is still needed;
- slices completed since the last checkpoint;
- proof run and skipped gates;
- parked items and why they were not implemented;
- whether another campaign should start from a new gate or entropy audit.
