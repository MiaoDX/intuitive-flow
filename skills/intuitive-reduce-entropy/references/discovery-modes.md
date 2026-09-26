# Discovery Modes

Name the mode and discovery intensity in one sentence tied to the prompt, with
a redirect only when a better mode or skill fits:

- **Repo entropy mode** (default for repo cleanup, maintenance, stale surfaces,
  source-of-truth drift, or "make this repo easier to work in"): agent
  guidance, human docs, tests, layout, architecture depth, stale APIs, cleanup
  gates.
- **Plan entropy mode** (default when the prompt points at an idea, draft plan,
  or plan file): missing decisions, weak assumptions, scope leaks, proof gaps,
  stale evidence, and questions for grill-batch or preflight.

The output is a ranked selection packet with one recommended next action. The
user selects; implementation starts only after they approve that action,
because selection is theirs and a silently narrowed packet hides options.

**Demand sanity gate.** Before accepting a candidate, decide whether the change
deserves to exist. An addition needs evidence that it beats reusing, narrowing,
documenting, or deleting an existing path; a removal needs evidence the
behavior is stale, misleading, unsupported, or outside current intent. When the
gate fails or stays uncertain, park the request with the pushback. This is
constructive pushback, not a veto ritual.

The goal is a repo where agents start quickly, humans review truth from a small
doc surface, tests show real behavior, and the next task does not require
rediscovering stale paths or unclear cleanup targets.

## Batch Discovery (Repo Entropy)

Return the serious group of current candidates in one pass, not a single point:
periodic maintenance is useful because the user sees the second- and
third-best candidates too.

For broad discovery, enter high-noise surfaces through the preflight:

1. Read the thin orientation surface (root agent guidance and canonical human
   docs).
2. Run the bundled high-noise summary from the target repo root before listing
   or searching history, planning, generated, log, large test, or profile roots.
3. Use the summary to decide which of those surfaces deserve candidate-level
   proof.
4. Deep-read only the window that proves a candidate; otherwise park it.

For narrow prompts, return 3-7 ranked candidates when that many pass the
No-Change Outcome Rule, fewer when evidence supports fewer. Each candidate is
decision-complete:

```text
Candidate N: <short target>
Severity: <P0 | P1 | P2>
Entropy source / Materiality: <source>; <false confidence | live source drift | stale surface | real workflow friction | recurring rediscovery>
Demand gate: <why an addition is justified, or why keeping a removed surface is worse>
Why now: <repo evidence, not taste>
Impact radius / Affected paths: <repo-wide | workflow | module | single-file>; <paths>
Owner skill: <specialist or this skill>
Suggested proof: <commands/searches>
Execution risk: <safe | needs approval because ...>
```

Add a zen hint (clarity principle) or pattern hint only when it helps the
reviewer. Batch by maintenance intent rather than file path: a stale README
source-of-truth issue, a false-green check, and a leftover wrapper belong
together because each surprises the next agent. Speculative ideas go to
`Parked items`.

## Cleanup Discovery Lens

A read-only lens for requests about unnecessary modules, stale architecture,
deletion or merge candidates, compatibility cleanup, or shrinking surface area.
Rank candidates:

1. Stale public or private surfaces whose replacements already exist.
2. Shims, aliases, wrappers, or legacy command paths with no external contract.
3. Duplicate owners for one concept, data envelope, fixture, route, report
   section, runtime state, or rule.
4. Modules that only preserve old names or pass through to another owner.
5. Tests or docs that keep stale surfaces alive instead of proving behavior.

Deletion candidates reduce concepts; extraction, formatting, line shuffling,
and "could be nicer" are not candidates. Park anything needing a product or
public-contract decision, unavailable proof, paid services, credentials,
hardware, or broad migration approval.

Each cleanup candidate adds: owner layer, why it is unnecessary, expected
simplification, behavior-change risk, blast radius, suggested proof, stop/ask
condition, and `Owner skill: $intuitive-refactor`. Mutation gates, campaign
checkpoints, and commit rules belong to `$intuitive-refactor`; a selected
cleanup candidate becomes a refactor gate or slice there.

## Plan Entropy Mode

The output is a plan-review selection packet, not implementation or approval.
For a plan file, read its `## Plan Ledger` first and stay in that session's
scope; if the review changes status, slice, next action, blocker, relations, or
no-touch boundary, refresh the ledger and dashboard row. Cross-plan risks are
linked or parked; other plans' ledgers change only after a session switch.

Read only what tests decision quality: the plan or idea, referenced docs and
context files, acceptance criteria, verification gates, and cited evidence.
Repo-wide maintenance enters only when the plan depends on it. Preferred
sources: missing or conflicting user-owned decisions; scope or non-goal
ambiguity; stale evidence; acceptance or verification gaps; hidden migration,
install, contract, cost, hardware, or credential risk; likely unknown-unknown
scout findings.

Next owners:

- `$grill-with-docs-batch`: unresolved terminology, domain, product, contract,
  or decision-quality questions;
- `gstack-autoplan`: optional scout for hidden execution, test, or DX surprise
  in non-trivial plan-backed work;
- `$intuitive-preflight`: an accepted plan that needs scope, acceptance,
  verification, stop gates, and worker strategy;
- `$intuitive-flow`: only after the contract is approved and reconciled into
  the canonical plan.

For requests that add, remove, or shrink behavior, the demand gate is the first
question: unproven value makes the missing decision or evidence the selected
candidate; a removal that could surprise users surfaces "should this really be
removed?" before any migration plan. Stop when what remains is implementation
defaults or polish; return `Selected candidates: none` when the plan is ready.

## Discovery Intensity And Loops

- **Quick scan:** simple, local, low-risk prompts; at most 1-3 material
  candidates and usually no plan document.
- **Selection scan:** the user already selected directions and wants related
  gaps; keep those directions as the anchor and park unrelated ideas.
- **Saturation scan:** "all directions", unknown unknowns, "continue until no
  more", repo-wide or old-repo cleanup, or when a missed direction would cause
  another planning loop. Run fresh bounded rounds from current `HEAD` until a
  round finds no P0/P1 or materially useful P2. Follow the evidence rather than
  a fixed checklist (code/test/scripts, then docs/agents/backlog, then a sweep
  is typical).

Present the whole serious group so the user can pick all, some, or none. A
suggested review order is guidance; the packet has no pre-chosen "first cut."

High-noise surfaces (history, generated output, planning workspaces, very large
test or profile trees) can hold real candidates; enter them through a budgeted
probe (list, find live references, sample) and deep-read only once a candidate
has a materiality reason.

For large loops, keep one discovery artifact on the selected plan surface when
the repo allows planning docs (path from
[plan selection](../../_shared/references/plan-paths.md)), with a Plan Ledger,
audit rounds, selected and parked items, proof, and stop condition, and a
dashboard row. Before adding another group, name the next candidate and why it
still deserves review; if that sentence is weak, stop with
`Selected candidates: none`.

When discovery feeds an existing maintenance goal, compare candidates with its
parked and rejected registries: a repeat updates `last_confirmed` and is new
only if the unblocker, risk, owner, or evidence changed.

Broad moves, deletes with uncertain consumers, public API changes, paid or slow
gates, and product-scope decisions appear in the packet as execution risks.
Compatibility removal is not itself a reason to keep the old shape; name the
concrete migration risk instead.

After selection, produce a compact selected-candidates packet if asked.
Implementation happens here only when the user changes the task to
implementation and confirms the set. Use a plan document as the state anchor
when work spans directions, sessions, contract decisions, non-trivial
verification, or later grill/preflight; keep simple local fixes inline.

End each run with one recommended next action and a shortcut: grill-batch for
open decisions, preflight for an accepted direction without a contract, Flow
for an approved preflighted plan, stop/park when nothing material remains. A
short "LGTM", "do it", or equivalent after a single recommended action approves
that action.

## Repo-Wide Maintenance Handoff

When discovery feeds an autonomous or periodic maintenance goal, return a
handoff instead of a chat list. The `$intuitive-refactor` campaign owns
mutation, proof, checkpoints, and commits; this handoff owns fresh
classification and deduplication.

```text
Maintenance handoff for: <gate/capsule path or "new repo-wide goal">
Discovery base: <HEAD commit or working tree state>
Existing registries checked: <paths or none>

Clear candidates:
1. <id> severity=<P1|P2> fingerprint=<stable owner/path/contract>
   materiality, why new or still clear, affected paths, owner skill, proof, execution risk

Parked candidates:
1. <id> fingerprint=<...> owner layer, park reason, exact unblocker,
   first seen, last confirmed, do-not-reopen-unless

Rejected low-value observations:
1. <id> fingerprint=<...> reason, materiality gap, first seen, last confirmed,
   do-not-reopen-unless

Saturation note: <why another immediate round is or is not expected to find clear work>
```

`Clear` means bounded, owned, reduces a concept or stale surface, and has
available proof. `Parked` means possibly valuable but needing a human decision,
public migration, unavailable or manual proof, credentials, or broad design.
`Rejected low-value` means polish, taste, formatting, weak materiality, or
support-only work that should ride with a real cleanup.
