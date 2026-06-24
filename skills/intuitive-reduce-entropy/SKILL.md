---
name: intuitive-reduce-entropy
description: |
  Periodically inspect a repository or plan and produce a ranked batch of
  high-value entropy reduction candidates. Use repo entropy mode when the user
  says the repo feels messy, asks what to clean next, wants to make an old repo
  easier for humans and AI agents, or wants maintenance suggestions without
  already knowing the target seam. Use plan entropy mode when the user points
  at an idea, draft plan, or named plan file and wants blind spots, missing
  decisions, or weak assumptions found before grill-batch/preflight. The skill
  must state the selected mode and why before auditing, return a no-change
  result instead of filling a requested count when only polish remains, choose
  an explicit discovery intensity, run saturation discovery when the user asks
  for all directions or unknown unknowns, and end with one recommended next
  action plus a short reply shortcut.
---

# Intuitive Reduce Entropy

Use this skill when entropy is the problem, but make the mode explicit before
auditing:

- `repo entropy mode`: repository maintenance across agent guidance, human
  docs, tests, repo layout, architecture depth, stale APIs, cleanup candidates,
  and cleanup gates.
- `plan entropy mode`: idea or plan review before execution, focused on missing
  decisions, weak assumptions, scope leaks, proof gaps, stale source evidence,
  and questions that should go to grill-batch or preflight.

Default to plan entropy mode when the prompt points at an idea, draft plan, or
named plan file. Default to repo entropy mode when the prompt asks for repo
cleanup, maintenance, stale surfaces, source-of-truth drift, or "make this repo
easier to work in."

Recommend less before more. For every material candidate, first ask whether the
maintainer surprise is best removed by deleting stale surface, merging duplicate
guidance, narrowing scope, reusing an existing route, or documenting current
truth. Recommend a new durable entity only when the shrink/reuse path cannot
make the evidence honest. When the user points at a concrete plan file, treat
that file as the selected scope by default: surface risky phases, sequencing,
and stop gates, but do not turn the final recommended action into "implement
only the first slice" unless the plan is demonstrably overbroad for the user's
goal, the user asked for slice selection, or a hard stop gate makes full-plan
execution dishonest.

Use the cleanup discovery lens when repo entropy shows stale APIs, duplicate
owners, compatibility wrappers, pass-through modules, stale tests/docs, or
module-sprawl. The lens ranks deletion, merge, and canonical-owner candidates;
it does not edit code, create campaign checkpoints, or decide mutation policy.
Selected code/API/module candidates hand off to `$intuitive-refactor`.

Before proposing any candidate, run a `Demand sanity gate`: decide whether the
requested change itself is worth doing. For feature additions, ask whether the
feature creates enough user or maintainer value to justify a new surface instead
of reusing, narrowing, or documenting an existing one. For feature removals or
scope cuts, ask whether the removed behavior is genuinely stale, misleading, or
out of scope rather than still valuable. If the gate fails or is uncertain, push
back and park the request instead of converting it into implementation work.
Every selected candidate should include `Demand gate:` with the pass reason.

## Modes

| Mode | Use when | Output | Redirect when |
| --- | --- | --- | --- |
| Repo entropy mode | The repo feels messy, has stale surfaces, or the user asks what to clean next. | Ranked maintenance candidates with source, evidence, owner, proof, risk, parked items, and next action. Use the cleanup discovery lens for deletion/merge/canonical-owner candidates. | The user already named a bounded refactor target. |
| Plan entropy mode | The input is an idea, draft plan, named plan file, or preflight draft. | Plan-review candidates for missing decisions, weak assumptions, proof gaps, and next owner. | The plan already has approved scope, non-goals, gates, and execution route. |
| Discovery-loop mode | The user asks for all serious directions, unknown unknowns, or to continue until saturated. | Fresh bounded rounds until no P0/P1 or materially useful P2 remains. | The request only needs a quick local answer. |

For non-trivial runs, state `Selected mode:`, `Why:`, and `Redirect:` before
auditing. For tiny direct work, one sentence can carry the same information.
Add a final `Mode note:` only when the user manually invoked this skill, the
request was ambiguous, or another mode/skill would fit better.

Start by saying:

```text
Selected mode: <repo entropy mode | plan entropy mode>
Why: <one sentence tied to the user's prompt>
Redirect: <none | better mode/skill and why>
Discovery intensity: <quick scan | selection scan | saturation scan>
```

This is the compact runtime entrypoint. Read the narrow reference only when the
compact rules below are not enough:

| Need | Read |
| --- | --- |
| Repo entropy, plan entropy, discovery-loop behavior, and selection handoff | `references/discovery-modes.md` |
| High-noise budgets, bounded command summaries, materiality gate, and no-change threshold | `references/high-noise-and-materiality.md` |
| Zen ranking, pattern fit, architecture review sequence, delegation, public entry model, and layout routing | `references/ranking-and-routing.md` |
| Default route, user-input routing, decision policy, stop condition, and report shapes | `references/handoff-and-reporting.md` |

## Discovery Intensity

Choose the scan intensity explicitly before auditing. This is the main lever
that prevents the user from having to ask "is that everything?" after a partial
packet.

- `quick scan`: use for simple, local, low-risk prompts. Inspect the narrow
  surface, return at most 1-3 material candidates, and do not create or require
  a plan document unless the evidence shows cross-session or multi-surface
  risk.
- `selection scan`: use when the user has already selected one or more
  directions and wants related gaps, adjacent risks, or supporting work found
  around those directions. Keep the selected directions as the anchor, update
  the existing plan when one exists, and park unrelated repo-wide ideas.
- `saturation scan`: use when the user asks for all directions, unknown
  unknowns, a loop, "continue until no more", "find all reduce entropy points",
  or when the user does not know what they should choose. Run fresh bounded
  rounds until a new round finds no P0/P1 or materially useful P2 candidate.

If the prompt is ambiguous, default to `quick scan` for tiny implementation
questions and `saturation scan` for architecture, workflow, skill, docs/source
of truth, or plan-backed work where missing a direction would likely cause
another discussion loop.

Do not present a small starter list when the user asked for saturation. Return
the complete serious group that passes the materiality bar, plus parked items
that were checked and rejected.

## Repo Entropy Route

1. Orient from the repo's thin source of truth first: root agent guidance and
   current human docs named by the repo.
   For over-engineering, bloat, YAGNI, or deletion-first repo cleanup prompts,
   use community `$ponytail-audit` as discovery input, then apply this skill's
   Demand gate and materiality bar before selecting candidates.
2. Before searching high-noise surfaces, run the bundled high-noise summary
   script from the target repo root.
3. Classify observations by entropy source:
   agent guidance, human docs, tests, repo layout, architecture discovery, known
   code cleanup, or workflow drift.
4. Deep-read only the smallest window needed to prove a candidate. If a probe
   would mostly increase transcript size, stop and report the candidate, parked
   observation, or saturation reason.
5. Prefer candidates that reduce the number of live surfaces or clarify which
   existing surface owns the behavior. Treat "add a new mechanism" as justified
   only when cleanup/reuse cannot remove the surprise.
6. Return a ranked packet of decision-complete candidates, or a no-change
   result when no candidate passes the materiality bar.

### Cleanup Discovery Lens

Use this lens inside repo entropy or discovery-loop mode when the prompt or
evidence points at stale architecture, deletion candidates, duplicate owners,
wrappers, aliases, compatibility paths, pass-through modules, or tests/docs that
keep old concepts alive. Keep it read-only and packet-shaped.

Rank candidates in this order:

1. Stale public or private surfaces whose active replacements already exist.
2. Compatibility shims, aliases, wrappers, or legacy command paths with no
   current external contract.
3. Duplicate owners for the same domain concept, data envelope, fixture, route,
   report section, runtime state, or workflow rule.
4. Modules that exist only to preserve old names or pass through to another
   owner.
5. Tests or docs that force stale surfaces to stay alive instead of proving
   current behavior.

Do not import `$intuitive-refactor`'s behavior-change policy, proof ladder,
campaign checkpointing, or commit rules. This skill should only label execution
risk, suggested proof, likely owner, and the stop/ask condition. If the user
selects a cleanup candidate, hand it to `$intuitive-refactor` for the mutation
gate and implementation.

For broad repo-wide or "continue until no more" requests, run discovery-loop
mode: fresh bounded rounds from current `HEAD` until a new round finds no P0/P1
or materially useful P2 direction. Record large loop rounds in one artifact when
the repo convention allows planning docs.

## Plan Entropy Route

Use plan entropy mode when the user points at an idea, draft plan, named
`docs/plans/<slug>.md`, review packet, or preflight draft and asks to reduce
ambiguity before execution. The output is a plan-review selection packet, not
implementation and not approval.

Inspect only the smallest context needed to test the plan's decision quality:
the plan or idea text, referenced human docs/context files, acceptance criteria,
verification gates, and source evidence named by the plan. Do not broaden into
repo-wide maintenance unless the plan itself depends on that surface.

Route the next owner by the unresolved object: domain/product/public-contract
questions to `$grill-with-docs-batch`, accepted plans without execution gates to
`$intuitive-preflight`, and approved contracts to `$intuitive-flow`.

Stop when remaining items are implementation defaults, weak polish, or already
covered by the plan. Return `Selected candidates: none` if the plan is already
clear enough for preflight or execution.

When reviewing a plan, suggest shrinking the existing plan before adding new
phases, components, tests, workers, docs, compatibility bridges, or tracking
artifacts. For an existing `docs/plans/<slug>.md`, shrink scope only when the
plan itself is broader than the user's stated goal or cannot be executed
honestly without a user decision. If the plan already defines the intended
scope, preserve that full scope and express risk as phase order, stop gates,
verification gates, or parked alternatives rather than recommending that flow
execute only one slice. If a new entity remains necessary, state what existing
option was rejected and what proof makes the addition unavoidable.

For an existing plan with a `## Plan Ledger`, keep plan entropy edits scoped to
that plan's session. If entropy review changes status, current slice, next
action, blocker, parent/child relation, or no-touch boundary, update the ledger
and the plan's row in `docs/plans/README.md`. Do not opportunistically
reclassify unrelated plans; report stale neighboring plans as parked
observations unless the user switches scope.

## Plan Artifact And Handoff

Use or update a plan document only when the work spans multiple directions,
sessions, architecture/public-contract decisions, non-trivial verification, or a
later grill/preflight step. Keep simple local fixes inline.

End every run with exactly one recommended next action unless there is genuinely
no useful action. Accept short replies such as `LGTM`, `sounds good`, or `do it`
as approval for that named next action.

## Context Budget

Treat history, generated output, planning workspaces, test collections, profile
registries, and local artifacts as high-noise surfaces. Enter them through
bounded indexes, counts, references, and samples, not full-body reads.

For broad or noisy discovery, prefer the bundled summary scripts, specific
searches, small windows, and bounded command summaries. Read
`references/high-noise-and-materiality.md` for exact commands and the full
high-noise surface budget.

## Candidate Bar

A candidate is eligible only when it prevents a future surprise a maintainer
would notice and passes the demand sanity gate. It must show at least one of:

- false confidence: a gate, test, script, build, report, or link check can pass
  while hiding a current misleading state;
- live source drift: current sources of truth disagree about a live command,
  route, owner, public surface, or workflow;
- stale surface: a reachable API, wrapper, command, output, index, or path
  remains after consumers moved;
- real workflow friction: a human or agent following current instructions would
  likely hit an error, dead end, or rediscovery loop;
- recurring rediscovery: a non-obvious rule repeatedly has to be inferred
  because it is not encoded in docs, tests, gates, or structure.

Reject wording polish, isolated neatness, speculative future cleanup, tiny
single-file metadata fixes, and support work counted separately from its parent
behavioral slice.

Reject candidates that primarily add a new abstraction, document, workflow, or
test layer unless their demand gate shows why the new surface is necessary and
they replace, remove, or clearly constrain a larger existing surface.

P0/P1 candidates are usually commit-worthy when backed by current evidence. P2
candidates need explicit impact radius and a maintainer test that justifies a
standalone review.

For open-ended loops, run the bundled materiality gate before adding another
group. If the gate recommends stopping, stop instead of filling quota.

## Architecture And Specialist Routing

For architecture-shaped candidates, public-contract cleanup, MCP/tool boundary
cleanup, lifecycle gates, or unclear module depth, cite existing equivalent
evidence or run the review sequence from `references/ranking-and-routing.md`
before calling the candidate decision-ready.

Route accepted work by object: human docs to `$intuitive-doc`, agent guidance to
`$intuitive-init`, tests to `$intuitive-tests`, code/API cleanup to
`$intuitive-refactor`, accepted directions without execution contracts to
`$intuitive-preflight`, and approved execution contracts to `$intuitive-flow`.

## Packet Shape

Return a compact ranked packet. Each candidate must be decision-complete with
target, demand gate, severity, entropy source, materiality, evidence, owner,
proof, and risk.

End every broad discovery or no-change result with these handoff markers:

```text
Entropy source:
Discovery intensity:
Selected candidates: <ranked list | none>
Entity budget:
Verification:
Parked items:
Saturation status:
Recommended next action:
Shortcut:
```

## Stop Rules

Stop when either a ranked packet is delivered for selection or the loop
saturates with `Selected candidates: none`. Do not edit production code, move
files, delete tests, or rewrite guidance while the user is still asking what
should be cleaned.

After the user selects candidates, preserve the selection, likely owners, proof
commands, risks, parked items, and stop condition. Do not silently narrow the
selection to one small slice.

Use `references/ranking-and-routing.md` for Zen ranking, pattern fit, layout
routing, delegation, and canonical cleanup. Use
`references/handoff-and-reporting.md` for decision policy and selection
handoff.
