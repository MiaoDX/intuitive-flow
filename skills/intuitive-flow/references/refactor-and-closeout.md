# Refactor And Closeout

Use this reference for architecture/refactor routes, semantic commit boundaries,
the final `$intuitive-doc` documentation-alignment sub-phase, and final
parked-todo reporting.

## Architecture Or Refactor Goal

Use when a Flow run needs to hand off, supervise, verify, or close out a
refactor-shaped slice. `$intuitive-refactor` owns refactor scope gates, accepted
severities, cleanup expansion, changed-code review, and stop conditions; Flow
keeps the route and closeout honest.

Default path:

```text
create or read refactor scope gate through $intuitive-refactor
$codebase-design + $plan-eng-review  # architecture packet before edits
$improve-codebase-architecture  # optional report-only scanner when no seam is accepted
TDD or diagnosis                 # only when accepted checklist needs proof first
execute only the $intuitive-refactor accepted slice
run one final $intuitive-doc doc-alignment sub-phase
record P2/Parked ideas instead of implementing them
```

Run `$codebase-design` for architecture-shaped work only when the current plan,
ADR, or refactor gate does not already contain an equivalent module, interface,
seam, caller, data-flow, and invariant map. Route to
`$improve-codebase-architecture` only when that first architecture review still
leaves no accepted target seam; keep its output report-only and return accepted
candidates to `$intuitive-refactor` before any production edit.

The refactor scope gate comes from `$intuitive-refactor` or an equivalent
approved refactor contract. It is the source of truth for the pass and must name:

- target module or boundary
- plan ledger/session scope when the gate is a `docs/plans/<slug>.md` file
- status marker: `DONE`, `CONTINUE`, `REOPEN`, or `PARK`
- accepted severities
- accepted issue checklist
- parked issues
- required evidence level
- affected human docs or explicit "no doc impact expected"
- persistent gate file, usually `docs/plans/refactor-<target>.md`
- stop condition

Follow the `$skill-runner` Codex delegation reference for worker handoffs. Use
short workers for report-only scans, stale-path searches, test discovery, and
independent verification probes; use delegated workers for broad or long-running
`$intuitive-refactor` execution. Direct edits from any worker require disjoint
ownership and main-session integration.

Once implementation starts, do not keep discovering and implementing new P2
cleanup. Add newly discovered work only when it is a P0/P1 regression found
while verifying the accepted checklist.

On repeated runs of the same refactor prompt, read the persistent gate first.
If status is `DONE` and evidence remains green, stop instead of rescanning for
fresh cleanup. Park P2-only taste or "could be cleaner" findings unless the user
expands scope or real usage shows repeated failure in that area.

## Final Documentation Alignment Sub-Phase

For significant code changes and every big refactor, run one explicit final
`$intuitive-doc` sub-phase after implementation, changed-code cleanup, and
verification, and before parked-todo closeout. This is part of the flow, not an
optional cleanup note. The goal is to leave the human-facing documentation
surface aligned after a large code change.

The sub-phase must compare the changed implementation surface to the target
repo's existing human-facing surface: `README.md`, `ARCHITECTURE.md`,
`STATUS.md`, `docs/human/**`, or explicitly named equivalents when present.
Do not create a missing human-doc tier merely to complete Flow closeout.

Use `$intuitive-doc guard` for focused changed-file checks only when the change
is small. Use `$intuitive-doc cleanup <scope>` for big refactors and whenever
the refactor changed public contracts, commands, package/module layout,
examples, proof artifacts, or human docs.

If human-surface docs drifted, update them to match current implementation. If
legacy human docs became AI coding guidance, process history, duplicated
material, or obsolete detail, move or remove them according to `$intuitive-doc`
cleanup rules. Look especially at stale files under `docs/human/**`, because
that folder is part of the default human truth and should not accumulate old
refactor-era instructions. Ask before broad moves/deletions, ambiguous external
consumers, or protected docs outside the accepted scope.

The sub-phase closeout must report one of:

- `$intuitive-doc`: updated `<paths>` and removed/moved `<paths>`
- `$intuitive-doc`: checked and left unchanged, with the checked doc set
- `$intuitive-doc`: skipped only because the flow was tiny/no human-facing truth
  could have changed, with that reason

If work touched domain terms, durable boundaries, or context-backed acceptance
criteria, re-check relevant `CONTEXT.md` or `CONTEXT-MAP.md`. Update it through
`grill-with-docs` semantics when terms changed; otherwise report it was checked
and left unchanged.

## Source Plan Freshness

For plan-backed implementation, inspect the source `docs/plans/<slug>.md`
before final closeout. The plan is still canonical pre-GSD history, but it must
not lie about shipped work after the implementation lands.

Update the plan when the run changed any of:

- plan ledger fields or `docs/plans/README.md` dashboard row;
- implementation status;
- public command/API/profile/MCP/tool contract;
- accepted scope or non-goals;
- verification evidence;
- remaining slices, parked follow-ups, or local-dev handoff.

Prefer a compact closeout block or metadata refresh over a long execution
ledger. A good plan closeout tells the next agent whether the plan is
`DONE`, `ACTIVE`, `PARKED`, `SUPERSEDED`, or partially complete, which session
scope is current, and which exact gates remain. Refresh the source plan's
`## Plan Ledger` and the `docs/plans/README.md` dashboard row when the status,
current slice, next action, blocker, parent/child relation, or no-touch scope
changed. If the plan remains unchanged, record why in the Flow closeout, such
as "source plan ledger already current" or "direct edit was not plan-backed".

Before writing closeout docs, run a small plan hygiene pass: if the plan or
active capsule has become append-only, replace stale sections with the current
objective, proof boundary, next gate, and evidence links. Do not add another
"Updated:" paragraph when the useful outcome is to delete or compress old
status. Routine command transcripts, worker play-by-play, repeated failed
attempts, and superseded approach notes belong in result artifacts or commits,
not in the hot-resume plan surface.

## Serena Memory Maintenance

After canonical docs/status/plans are updated, check Serena memories when the
target repo appears configured for them. Treat Serena as an agent acceleration
layer, not the source of truth.

Configuration signals:

- Serena memory tools are available in the session, such as `list_memories`,
  `read_memory`, `write_memory`, or `edit_memory`;
- `serena memories list .` succeeds in the target repo;
- `.serena/project.yml` exists, even when `.serena/` is ignored by Git.

If configured, inspect existing memory names and only read likely impacted
memories. Update memories when this flow changed stable, non-obvious facts that
future agents would otherwise rediscover incorrectly, such as:

- canonical commands, test wrappers, or setup routes;
- repo-specific conventions, source-of-truth rules, or durable architecture
  boundaries;
- stable package/module ownership or public contract names.

Do not put volatile current status, active phase progress, one-off decisions,
logs, secrets, API keys, local artifact paths, or large copied docs into
memories. If a memory would merely duplicate `README.md`, `ARCHITECTURE.md`,
`STATUS.md`, `AGENTS.md`, or `docs/human/**`, prefer a short pointer to the
canonical doc instead of copying the content.

Run `serena memories check . --include-unmarked --fuzzy-matching` when the CLI
is available and memory references changed. This catches broken `mem:`
references, not semantic drift; still manually compare stale operational facts.

If memories are ignored by Git, memory updates are local-only unless the repo
explicitly tracks curated `.serena/project.yml` or `.serena/memories/**`. Do not
fail closeout merely because Serena is unavailable or unconfigured; report
`Serena memories: not configured/not available`.

## Semantic Commits

Auto-commit is the default for durable implementation and refactor work. The
user's request to execute the work authorizes commits of verified owned changes;
do not wait for a second "commit" request.

Use this decision table:

| State | Action |
| --- | --- |
| Coherent owned slice with focused proof | Stage owned paths/hunks and commit before the next slice. |
| Unrelated dirty files outside the slice | Leave them untouched; still commit the owned slice. |
| Inherited in-scope changes | Inspect and verify them, then include them in the owned commit. |
| Same-file overlap that can be separated safely | Use hunk-specific staging and commit the owned hunks. |
| Current user says not to commit; repo/phase forbids it; stop condition is review-only; same-file overlap is unsafe; or the slice has an unresolved blocker | Do not commit; cite the exact source or file/blocker in closeout. |
| Unsourced handoff note such as "commits disabled" | Ignore it and follow the default. |

For each commit:

1. Confirm one reviewer-revertible intent and no unresolved blocker.
2. Run focused proof appropriate to that slice.
3. Inspect `git status`, stage only owned paths or hunks, and inspect the staged
   diff. Exclude unrelated artifacts and user-owned edits.
4. Commit with the repo's message style and required trailers.
5. Record the commit id, then continue.

Prefer multiple commits for independently reviewable plan, implementation,
test, cleanup, or docs units. Use one commit for one compact intent. If several
slices accumulated, split them when practical; otherwise make one verified
catch-up commit rather than leaving the owned tree dirty.

Before final closeout, check the commit invariant: every verified owned file is
committed, or the closeout names one allowed blocker from the decision table.
Generic caution, an inherited dirty worktree, unrelated files, or lack of a
separate commit request are not allowed blockers.

Fallback commit message style when no local style is obvious:

- `docs(plan): ...`
- `chore(workflow): ...`
- `feat(<area>): ...`
- `fix(<area>): ...`
- `refactor(<area>): ...`
- `test(<area>): ...`
- `docs(<area>): ...`

## Implementation Closeout And Parked Todos

Before final answer after implementation/refactor, inspect the canonical
artifact: `docs/plans/<slug>.md`, a refactor scope gate, `.planning/STATE.md`,
or the active phase plan. Extract anything explicitly parked, deferred,
out-of-scope, future-only, or left for focused follow-up.

Also include newly discovered but intentionally unimplemented work from
execution notes, changed-code review output, and verification gaps.

Always show parked work. If empty, say:

```text
Parked todos: none found in the canonical artifact or implementation notes.
```

Parked-todo shape:

```text
Parked todos:
- <item> - parked because <reason>; source: <plan/review/doc>; unpark when <trigger>
```

Before final closeout, classify each parked item for reporting:

| Class | Meaning | Action |
| --- | --- | --- |
| `in-scope-required` | Original objective is not actually complete without this item. | Continue before marking complete. |
| `in-scope-high-value` | Same objective/scope, bounded, likely useful, and has a clear verification gate. | Report as a candidate follow-up unless `$intuitive-refactor` already accepted it. |
| `deferred-by-policy` | Explicitly excluded by user, plan, safety rule, or acceptance boundary. | Report only. |
| `scope-expansion` | New product/architecture direction or materially broader than the original goal. | Report only. |
| `needs-human-decision` | Technically plausible, but changes authority, UX, product promise, dependency policy, or risk profile. | Ask before execution. |

Parked-follow-up rules:

- Continue only for `in-scope-required`, because the original objective is not
  complete. For `in-scope-high-value`, route back through `$intuitive-refactor`
  unless that item is already inside the accepted checklist.
- The follow-up must be a coherent slice with an explicit verification command
  or durable evidence artifact.
- Do not auto-run `scope-expansion`, `deferred-by-policy`, or
  `needs-human-decision` items.
- Do not turn closeout into a new cleanup loop. List remaining parked work and
  stop unless the user explicitly approves the next `$intuitive-refactor` slice.
- If the follow-up would require a new plan, new dependency policy, baseline
  blessing, broad migration, or external/human-owned evidence, classify it as
  `needs-human-decision` or `scope-expansion` instead of auto-running it.

When an accepted refactor follow-up runs, treat it as part of the same root flow:
update the plan, implement the slice, verify it, commit if files changed, and
then perform closeout again.

Always include the final `Scope changes` closeout category, even when no
unknown-unknown scout ran. Keep accepted scope changes separate from
parked/deferred work: accepted changes are now in the implemented plan, parked
items are not done. Scope-change sources can include unknown-unknown scout,
plan reconciliation, GSD handoff, refactor gates, or execution discoveries.
