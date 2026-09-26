# Ratchet Campaign

Use this overlay when a refactor ratchet runs across many slices, workers, or
hours. A campaign may be long-lived but not open-ended: every slice still needs
an owner-backed simplification claim, focused proof, a checkpoint, and a stop
condition.

Read [durable run](../../_shared/references/durable-run.md) before starting or
resuming. It owns the run-control gates, the active capsule, checkpoint cadence,
worker shape, context budget, and proof selection.

## Two Shapes

- **Selected-slice campaign:** start from an accepted gate or a
  `$intuitive-reduce-entropy` selected-candidate packet. Execute clear bounded
  slices, park uncertain ones, and ask reduce-entropy for fresh discovery when
  the packet is exhausted. Stop when two consecutive discovery handoffs cannot
  produce another safe P1/P2 slice.
- **Repo-wide maintenance goal:** when the user explicitly asks for recurring
  or whole-repo architecture maintenance, keep discovery and execution inside
  one goal: discover from current `HEAD`, execute every clear P1/P2 slice, then
  rediscover. Stop when a saturation round finds no new clear candidate after
  deduplicating against the parked and rejected registries.

Enter the overlay only for an explicit keep-going/campaign request, a
recurring-maintenance request with an accepted gate or granted autonomy, a gate
already at `CONTINUE`, or a multi-slice ratchet objective. A vague "make it
better" starts with a scope gate or `$intuitive-reduce-entropy`, because a
campaign without a target turns into browsing.

## State

Two surfaces, never more:

- **Canonical gate:** the existing plan, or the path from
  [plan selection](../../_shared/references/plan-paths.md) (recommended
  `docs/plans/MM-DD-refactor-<target>.md`). It owns scope, accepted severities,
  checklist, stop condition, verification inventory, clear queue, parked
  registry, rejected low-value registry, and final evidence. Keep any
  `docs/plans/README.md` dashboard row for this gate current.
- **Active capsule:** the task-owned resume surface from durable run: current
  slice, last proof, next candidate and proof, blocker fingerprint, and owner.

Reusable campaign prompts stay stateless; record the repo-local decisions they
produce, not the prompt. Chat history, commits, and temporary logs are not the
handoff source.

When a campaign starts, add to the gate: the quality signal being ratcheted
(line count, duplicate concepts, stale API count, and so on, as pressure rather
than goal), verification inventory, clear queue, parked registry, rejected
low-value registry, and the stop rule.

## Registries

Parked and rejected items carry a stable fingerprint so rediscovery updates
them instead of reopening them:

```text
fingerprint: <stable owner/path/contract>
reason: <parked: needed decision or proof | rejected: materiality gap>
exact unblocker / do-not-reopen-unless: <condition>
first seen / last confirmed: <dates>
```

Parked means human judgment, public API/CLI/schema migration, new runtime
design, unavailable or manual proof, credentials, or broad migration approval.
Rejected means polish, taste, formatting, or weak materiality. Neither blocks the
campaign; both keep it from rediscovering the same non-work.

## Slice Loop

For each slice, prefer deletion, then merging duplicate concepts, then moving
behavior to an existing owner; create a new owner or extract a helper only
around a named ownership boundary. Record a compact claim in the gate:

```text
Slice / owner layer:
Current friction and simplification:
Behavior-change class:
Proof:
```

Reject a slice whose claim is only "make the file smaller." Edit code, callers,
tests, and docs together; run the smallest proof for the change class (durable
run's proof selector); checkpoint; commit.

When the next seam is unclear, the candidates have drifted into small hardening
work, or scouts keep returning polish, ask reduce-entropy for a fresh read-only
discovery handoff instead of browsing for local cleanup.

Record value metrics per committed slice and at closeout: surfaces deleted,
duplicate owners merged, wrappers or aliases removed, callers migrated, new
owners added, and public contracts touched or preserved.

## Commits And Checkpoints

Verified implementation slices are commit-shaped by default: commit when the
slice's focused proof passed, `git diff --check` is clean, and the staged diff
holds only this slice plus its gate or capsule updates. Skip the commit for
discovery-only or parked-only results, failed or unavailable proof, inseparable
unrelated work, an unaccepted public-contract migration, or a user request to
review first; name the reason. If hooks fail in scope, fix the slice; otherwise
unstage and report.

Checkpoint after each committed slice and at least every 60-120 minutes: update
the capsule, the gate when queue, registries, or evidence changed, and the
dashboard row. Keep the gate as batch summaries, not a transcript.

## Continue Or Stop

Continue while the next slice is inside the accepted gate, backed by a real
owner, expected to delete, merge, or canonicalize a concept, and verifiable
now. Stop, park, or ask when the next candidate is polish, needs an unaccepted
public migration or unavailable proof, the plan is growing faster than the code
shrinks, the saturation rule above is met, or the latest user message asks for
status or discussion rather than execution.

## Campaign Closeout

Close when the checklist is complete, the gate is `DONE` or `PARK`, and proof is
green or honestly blocked. Reconcile canonical evidence in the gate first,
then remove the capsule from the active namespace. Report the gate path and
status, slices completed, proof run and skipped, parked items with their
unblockers, rejected observations that explain the stop, and whether a new gate
or discovery handoff should follow.
