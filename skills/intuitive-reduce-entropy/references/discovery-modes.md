# Intuitive Reduce Entropy

Use this skill when entropy is the problem, but make the mode explicit before
auditing:

- `repo entropy mode`: repository maintenance across agent guidance, human
  docs, tests, repo layout, architecture depth, stale APIs, and cleanup gates.
- `plan entropy mode`: idea or plan review before execution, focused on missing
  decisions, weak assumptions, scope leaks, proof gaps, stale source evidence,
  and questions that should go to grill-batch or preflight.

Default to plan entropy mode when the prompt points at an idea, draft plan, or
named plan file. Default to repo entropy mode when the prompt asks for repo
cleanup, maintenance, stale surfaces, source-of-truth drift, or "make this repo
easier to work in."

Start by saying:

```text
Selected mode: <repo entropy mode | plan entropy mode>
Why: <one sentence tied to the user's prompt>
Redirect: <none | better mode/skill and why>
Discovery intensity: <quick scan | selection scan | saturation scan>
```

Then diagnose likely entropy sources and return a ranked selection packet of
bounded candidates. It should recommend one next workflow action for the packet,
but must not silently narrow the selected candidate set or start implementation
until the user approves that action.

Run the `Demand sanity gate` before accepting any candidate: decide whether the
requested change itself deserves to exist. This is constructive pushback, not a
veto ritual. For feature additions, require evidence that the new surface
creates enough user or maintainer value to justify not reusing, narrowing,
documenting, or deleting an existing path. For feature removals or scope cuts,
require evidence that the behavior being removed is stale, misleading,
unsupported, or outside current product/workflow intent. If the gate fails or
remains uncertain, park the request and explain the pushback instead of turning
it into implementation scope.

The default goal is a repo where future agents can start quickly, humans can
review current truth from a small doc surface, tests show real behavior, and
the next meaningful task does not require rediscovering stale paths, bloated
agent files, mixed doc tiers, or unclear cleanup targets.

## Batch Discovery Default

This section describes repo entropy mode.

Default to a batch-first audit, not a single-point recommendation. When the
user asks to "reduce entropy", "find cleanup", "make this repo easier to work
in", or gives no target surface, inspect broadly enough to return the serious
group of current candidates in one pass.

For broad or repo-wide discovery, use this preflight before any high-noise
directory read:

1. Read only the repo's thin orientation surface first: root agent guidance and
   the root/current human docs the repo names as canonical.
2. Run the bundled high-noise summary script from the target repo root.
3. Use that summary to decide which history, planning, generated, log, test, or
   profile surfaces deserve candidate-level proof.
4. Deep-read only the smallest window needed to prove a candidate; otherwise
   park the observation.

If you are about to run a command that lists or searches a high-noise root
before this preflight, stop and run the summary script instead.

For narrow prompts, the expected output is a ranked batch of 3-7 candidates
when that many pass the No-Change Outcome Rule. Use fewer only when the repo
evidence only supports fewer real findings. Do not hide the second- and
third-best candidates just because one candidate is clearly highest-value;
showing the batch is what makes the pass useful for periodic maintenance.

Each candidate should be decision-complete and pass the materiality contract:

```text
Candidate N: <short target>
Severity: <P0 | P1 | P2>
Entropy source: <source>
Demand gate: <pass reason; for additions say why a new feature/surface is justified, for removals say why keeping it would be worse>
Materiality: <false confidence | live source drift | stale surface | real workflow friction | recurring rediscovery>
Why now: <repo evidence, not taste>
Impact radius: <repo-wide | workflow | module | single-file>
Maintainer test: <one sentence explaining why this deserves review now>
Affected paths: <paths>
Owner skill: <specialist or this skill>
Zen hint: <clarity principle advanced>
Pattern hint: <pattern fit, or direct cleanup is clearer>
Suggested proof: <commands/searches>
Execution risk: <safe | needs approval because ...>
```

Batch candidates should be related by maintenance intent, not necessarily by
file path. A good batch might include one stale README source-of-truth issue,
one false-green verification issue, and one confirmed leftover wrapper, because
all three make the next human or agent less surprised. Keep speculative ideas
out of the ranked batch and put them in `Parked items`.

## Cleanup Discovery Lens

Use this lens inside repo entropy or discovery-loop mode when the user asks for
unnecessary modules, stale architecture, deletion candidates, merge candidates,
compatibility cleanup, or a faster way to reduce code/architecture surface. It
is a read-only discovery lens, not a refactor execution mode.

Rank deletion/merge/canonical-owner candidates in this order:

1. Stale public or private surfaces whose active replacements already exist.
2. Compatibility shims, aliases, wrappers, or legacy command paths with no
   current external contract.
3. Duplicate owners for the same domain concept, data envelope, fixture, route,
   report section, runtime state, or workflow rule.
4. Modules that exist only to preserve old names or pass through to another
   owner.
5. Tests or docs that force stale surfaces to stay alive instead of proving
   current behavior.

Do not count pure extraction, formatting, line shuffling, or "could be nicer"
as deletion candidates. Park candidates that require a product/public-contract
decision, unavailable proof, paid services, credentials, hardware, or broad
migration approval.

For each cleanup candidate, include:

```text
Owner layer:
Why unnecessary:
Expected simplification:
Behavior-change risk:
Blast radius:
Suggested proof:
Stop/ask condition:
Owner skill: $intuitive-refactor
```

Do not import `$intuitive-refactor`'s mutation gate, behavior-change policy,
campaign checkpoints, or commit rules. If the user selects a cleanup candidate,
the next action is a refactor gate or execution slice in `$intuitive-refactor`.

## Plan Entropy Mode

Use plan entropy mode when the user points at an idea, draft plan, named
`docs/plans/<slug>.md`, review packet, or preflight draft and asks to reduce
ambiguity before execution. The output is a plan-review selection packet, not
implementation and not approval.

When the target is a `docs/plans/<slug>.md` file, read its `## Plan Ledger`
first if present and keep the review locked to that session scope. If the
review updates the plan's status, current slice, next action, blocker,
parent/child relation, or no-touch boundary, refresh the ledger and the plan's
row in `docs/plans/README.md`. Cross-plan risks may be linked or parked, but do
not reclassify unrelated plan ledgers without an explicit session switch.

Inspect only the smallest context needed to test the plan's decision quality:
the plan or idea text, referenced human docs/context files, acceptance criteria,
verification gates, and source evidence named by the plan. Do not broaden into
repo-wide maintenance unless the plan itself depends on that surface.

Plan entropy candidates should use the same candidate shape, but prefer these
entropy sources:

- missing or conflicting user-owned decision;
- scope/non-goal ambiguity;
- stale source evidence or source-of-truth drift;
- acceptance or verification gap;
- hidden migration, install, public contract, cost, hardware, or credential
  risk;
- likely unknown-unknown scout finding that should run before grill-batch or
  preflight.

Classify each candidate's next owner:

- `$grill-with-docs-batch` for unresolved terminology, domain, product,
  contract, or decision-quality questions;
- `gstack-autoplan` as an optional planning-stage unknown-unknown scout for
  non-trivial plan-backed work when the risk is hidden execution/test/DX
  surprise;
- `$intuitive-preflight` when the plan is accepted but needs execution scope,
  acceptance, verification, stop gates, and worker strategy;
- `$intuitive-flow` only after the plan/preflight contract is approved and
  reconciled into the canonical plan.

Stop when remaining items are implementation defaults, weak polish, or already
covered by the plan. Return `Selected candidates: none` if the plan is already
clear enough for preflight or execution.

For user requests that add, remove, or shrink product/workflow behavior, treat
the demand sanity gate as the first plan-entropy question. If the request's
value is unproven, the selected candidate should be the missing decision or
evidence, not the requested implementation. If removing behavior could surprise
current users or agents, surface the "should this really be removed?" decision
before any migration or deletion plan.

## Discovery Loop And Selection Handoff

Discovery and implementation have different boundaries:

- Name the discovery intensity before auditing:
  `quick scan`, `selection scan`, or `saturation scan`.
  - Use `quick scan` for simple, local, low-risk prompts. Return at most 1-3
    material candidates and usually avoid creating a plan document.
  - Use `selection scan` when the user has already selected one or more
    directions and wants related gaps, adjacent risks, or supporting work found
    around those directions. Keep the selected directions as the anchor and
    park unrelated repo-wide ideas.
  - Use `saturation scan` when the user asks for all directions, unknown
    unknowns, a loop, "continue until no more", or "find all reduce entropy
    points", or when missing a direction would likely cause another planning
    loop. Run fresh bounded rounds until the next round finds no P0/P1 or
    materially useful P2.
- Discovery should surface the complete serious group of current candidates so
  the user can choose all, choose a subset, or defer everything with full
  context.
- Do not frame one candidate as "the first cut", "the easiest slice", or the
  skill's chosen implementation target. A recommended order is only planning
  guidance; it is not a selection.
- For narrow prompts, run one broad-enough pass and return the ranked batch.
- For repo-wide prompts, old-repo cleanup, "as much as possible", "all big
  directions", "again and again", "continue until no more", or similar
  saturation language, enter saturation scan / discovery-loop mode by default.
- In discovery-loop mode, run fresh rounds from current `HEAD` until another
  round no longer finds a P0/P1 or materially useful P2 direction. A typical
  loop is code/test/script surface, docs/agent/backlog surface, then saturation
  sweep, but follow the repo evidence instead of a fixed checklist.
- In broad discovery, treat history, generated output, planning workspaces, and
  very large test/profile surfaces as high-noise surfaces, not forbidden
  surfaces. They can absolutely produce real cleanup candidates, but they must
  be entered through a budgeted probe first: list/index, find live references,
  sample the smallest evidence needed, and only deep-read when a candidate
  already has a materiality reason.
- For large loops, create or update one discovery artifact under
  `docs/plans/` when the target repo convention allows planning docs. Record
  a top `## Plan Ledger`, audit rounds, selected candidates, parked items,
  suggested proof, and the stop condition in that one artifact instead of
  scattering partial batches through chat. Update `docs/plans/README.md` when
  this creates or changes a plan-backed discovery artifact's dashboard row.
- Before adding another group in a loop, run a saturation audit: name the next
  candidate, its materiality reason, and why it still deserves review after the
  previous rounds. If that sentence is weak, stop with `Selected candidates:
  none`.
- Mark broad file moves, deletes with uncertain consumers, public API changes,
  paid/slow/local-provider gates, and product-scope decisions as execution
  risks. Do not hide them from the discovery packet just because they need
  approval before implementation. Do not classify compatibility removal itself
  as a reason to preserve the old shape; classify the concrete migration risk.
- After the user selects candidates, produce a compact selected-candidates
  packet if asked. Do not implement the candidates inside this skill unless the
  user explicitly changes the task from discovery to implementation and
  confirms the selected set.
- For complex work, use or update a plan document as the state anchor when the
  work spans multiple directions, sessions, architecture/public-contract
  decisions, non-trivial verification, or later grill/preflight. Keep simple
  local fixes inline.
- End every discovery run with one recommended next action and a shortcut. If
  the packet has unresolved product, terminology, public-contract, or
  decision-quality questions, recommend `$grill-with-docs-batch`. If the
  direction is accepted but lacks an execution contract, recommend
  `$intuitive-preflight`. If the plan is preflighted and approved, recommend
  `$intuitive-flow`. If no material candidates remain, recommend stopping or
  parking. When the previous assistant message names exactly one recommended
  next action, treat "LGTM", "sounds good", "do it", and equivalent short
  replies as approval to run that next action rather than asking the user to
  restate the workflow.
