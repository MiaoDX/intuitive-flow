# Ratchet Campaign

Use this reference when a refactor ratchet is expected to run across many
slices, many workers, or many hours. A campaign is allowed to be long-lived, but
it is not open-ended: every slice still needs an owner-backed simplification
claim, focused proof, checkpoint, and stop condition.

The campaign default is an automated discovery/execution loop: discover a batch
of high-value architecture candidates, execute only clear bounded ones, record
uncertain or human-decision candidates as parked, then run fresh discovery
again. Stop only after repeated discovery cannot find another safe P1/P2 slice,
or when remaining work needs a public migration, unavailable proof, or design
decision.

Read `../../_shared/references/durable-run.md` before starting or resuming a
campaign. The shared file owns latest-user-intent gates, active capsules,
checkpoint cadence, control-plane/worker shape, context budget, and proof
selection.

## Campaign Entry

Enter campaign mode only when one of these is true:

- the user explicitly asks to keep refactoring, keep cleaning, continue a
  ratchet, or run a long cleanup campaign;
- the user asks for periodic, automatic, or recurring architecture cleanup that
  should keep finding clear refactor wins without stopping after the first
  discovered batch;
- an existing refactor gate has status `CONTINUE` and the latest user message
  asks to continue or keep going;
- the accepted objective is a code-size, complexity, stale-surface,
  compatibility, test-sprawl, or architecture-quality ratchet with multiple
  known slices.

Do not enter campaign mode for a vague "make it better" prompt without a gate.
Use scope gate or `$intuitive-reduce-entropy` first. For periodic architecture
cleanup where the user has not named a seam, start with `$intuitive-reduce-entropy`
in repo entropy or discovery-loop mode. Once there is a candidate packet or
refactor gate, campaign mode may keep invoking fresh discovery between batches
without asking the user to choose every obvious next slice.

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
Discovery cadence:
Consecutive no-clear-candidate passes:
```

The quality signal can be line count, duplicated concepts, stale API count,
test fixture duplication, dependency surface, or another repo-local metric. It
is pressure, not the goal. The goal remains concept reduction and ownership
clarity.

## Discovery/Execution Loop

Use this loop when the user wants the campaign to be more autonomous or
periodic:

1. Run a fresh discovery pass before the first slice and after each completed
   batch of clear slices. Use `$intuitive-reduce-entropy` repo entropy mode, an
   architecture-deletion audit from `ratchet-mode.md`, or focused scout workers
   depending on the current uncertainty.
2. Rank candidates by architecture value: stale-surface deletion,
   duplicate-owner merge, canonical owner move, pass-through wrapper removal,
   then test/docs simplification that stops preserving stale concepts.
3. Execute only candidates that are clear, bounded, contract-preserving or
   explicitly behavior-preserving, and verifiable with focused proof.
4. Park candidates that need human judgment, public API/CLI/schema/report
   migration, new runtime design, unavailable proof, hardware/manual evidence,
   or broad migration approval. Record the owner layer, why it is parked, and
   the decision or proof needed to unpark it.
5. After the current clear batch passes proof and checkpointing, run another
   discovery pass instead of stopping immediately.
6. Stop only when two consecutive discovery passes cannot name a clear P1/P2
   slice with a deletion, merge, canonical owner move, stale-surface removal,
   or material maintainer surprise.

Do not count parked candidates as progress blockers. They are decision records
that keep the campaign moving to the next clear slice. Do not keep re-auditing
the same parked area unless new code or user intent changes the decision.

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
for arbitrary local cleanup. In autonomous/periodic campaign mode, return to
fresh ranked discovery and execute the recommended clear candidate when it
meets the continue criteria. If discovery returns only parked or risky work,
record that pass and either run one more independent discovery pass or stop
after the second consecutive no-clear-candidate pass.

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

## Commit Policy

In campaign mode, make verified implementation slices commit-shaped by default.
After each slice or clear batch, create a semantic commit when all of these are
true:

- the slice changed source, tests, docs, or planning/capsule state;
- focused proof passed, or an explicitly accepted narrower proof passed with
  residual risk recorded;
- `git diff --check` passes;
- the staged diff contains only this verified slice and its matching gate or
  capsule updates;
- repo guidance does not forbid commits and the latest user message did not
  ask to leave changes uncommitted.

Do not commit when the run is discovery-only, the result is only parked
decisions, proof failed or was unavailable, unrelated dirty work cannot be
separated, the slice touches a public contract whose migration has not been
accepted, or the user asks for review before committing.

Before committing, inspect the staged stat and check output. Include repo-local
trailers or message conventions. If local hooks or commit checks fail, fix the
slice when the failure is in scope; otherwise unstage and report the blocker
without pretending the campaign is checkpointed.

## Checkpoint Rhythm

Checkpoint after every committed slice and at least every 60-120 minutes during
a long campaign. The checkpoint should update:

- active capsule with current status, last proof, next slice/proof, and parked
  work;
- canonical gate when accepted checklist, verification inventory, stop
  condition, campaign status, or final evidence changes;
- semantic commit for verified implementation slices by default, following the
  commit policy above;
- discovery pass count, clear candidates executed, and parked candidates when
  running the automated discovery/execution loop.

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
- two consecutive fresh discovery passes in autonomous campaign mode produce no
  clear safe P1/P2 slice after parking uncertain items;
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
