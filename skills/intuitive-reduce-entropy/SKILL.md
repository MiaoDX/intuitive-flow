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
Discovery intensity: <quick scan | selection scan | saturation scan>
```

This is the compact runtime entrypoint. Read
`references/detailed-guidance.md` only when the compact rules below are not
enough to decide materiality, discovery depth, architecture review sequence,
layout routing, delegation, plan-review ownership, or output shape.

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
2. Before searching high-noise surfaces, run the bundled summary script from the
   target repo root:

   ```bash
   node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/high-noise-summary.mjs"
   ```

3. Classify observations by entropy source:
   agent guidance, human docs, tests, repo layout, architecture discovery, known
   code cleanup, or workflow drift.
4. Deep-read only the smallest window needed to prove a candidate. If a probe
   would mostly increase transcript size, stop and report the candidate, parked
   observation, or saturation reason.
5. Return a ranked packet of decision-complete candidates, or a no-change
   result when no candidate passes the materiality bar.

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

## Plan Artifact And Handoff

For complex tasks, anchor the discussion in a plan document. Use or create a
plan when the work spans multiple directions, multiple sessions, architecture or
public-contract decisions, non-trivial verification, or a later grill/preflight
step. Keep simple local fixes inline.

When a plan exists, update it with a compact lifecycle block when useful:

```text
Status: Draft | Entropy-reviewed | Grilled | Preflighted | Approved | Executing | Verified
Last reviewed:
Current decision:
Next step:
Open questions:
Parked:
```

At the end of every run, name exactly one recommended next action unless there
is genuinely no useful next action. Prefer the route that follows from the
packet:

- unresolved product/domain/public-contract questions ->
  `$grill-with-docs-batch`;
- accepted direction but missing execution contract -> `$intuitive-preflight`;
- preflighted and approved contract -> `$intuitive-flow`;
- no material candidates -> stop or park.

Accept short replies as approval for the single recommended next action. If the
last output says `Shortcut: reply "LGTM" to run grill batch and update the
plan`, then a later "LGTM", "sounds good", "do it", or equivalent should start
that next action instead of asking the user to restate the workflow.

## Context Budget

Treat history, generated output, planning workspaces, test collections, profile
registries, and local artifacts as high-noise surfaces. Enter them through
bounded indexes, counts, references, and samples, not full-body reads.

For broad discovery, prefer:

- the high-noise summary script above;
- specific `rg -n <token> <paths>` searches;
- small `sed` windows;
- temp logs with bounded summaries for tests, linters, or generated reports.

For noisy commands, use the bundled command summarizer instead of pasting raw
output:

```bash
node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/bounded-command-summary.mjs" \
  --kind generic --timeout 180 -- \
  <command> <args...>
```

For `pytest --collect-only`, use `--kind pytest-collect`.

Read `references/detailed-guidance.md` for the full high-noise surface budget,
including `.planning`, `docs/plans`, `output`, `logs`, large tests, profiles,
and generated artifacts.

## Candidate Bar

A candidate is eligible only when it prevents a future surprise a maintainer
would notice. It must show at least one of:

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

P0/P1 candidates are usually commit-worthy when backed by current evidence. P2
candidates need explicit impact radius and a maintainer test that justifies a
standalone review.

For open-ended loops, write candidates to JSON and run:

```bash
node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/materiality-gate.mjs" candidates.json
```

If the gate recommends stopping, stop instead of filling quota.

## Architecture And Specialist Routing

If a candidate is architecture-shaped, public-contract cleanup, MCP/tool
boundary cleanup, lifecycle gates, or unclear module depth, run the architecture
review sequence before presenting it as decision-ready:

1. `$zoom-out`: map relevant modules, callers, contracts, data flow, and
   invariants.
2. `$plan-eng-review`: stress-test fit, edge cases, gates, performance/cost,
   and rollout risk.
3. `$intuitive-refactor`: only after the accepted seam, evidence ladder, and
   stop condition are explicit.

Use `$improve-codebase-architecture` only as optional extra report-only
architecture/deepening candidate discovery when the review sequence still
leaves no accepted target seam.

Skip this sequence only when a current plan, ADR, or gate already contains
equivalent evidence; cite that source.

Route accepted specialist work by object:

- human docs -> `$intuitive-doc`;
- agent guidance, hooks, skills setup, MCP/LSP guidance -> `$intuitive-init`;
- tests, markers, fixtures, pruning -> `$intuitive-tests`;
- code/module/API cleanup and stale wrappers -> `$intuitive-refactor`;
- execution contracts -> `$intuitive-preflight`.

## Packet Shape

Each candidate should be decision-complete:

```text
Candidate N: <short target>
Severity: <P0 | P1 | P2>
Entropy source: <source>
Materiality: <false confidence | live source drift | stale surface | real workflow friction | recurring rediscovery>
Why now: <repo evidence, not taste>
Impact radius: <repo-wide | workflow | module | single-file>
Maintainer test: <why this deserves review now>
Affected paths: <paths>
Owner skill: <specialist or this skill>
Zen hint: <clarity principle advanced>
Pattern hint: <pattern fit, or direct cleanup is clearer>
Suggested proof: <commands/searches>
Execution risk: <safe | needs approval because ...>
```

End broad discovery with:

```text
Entropy source:
Discovery intensity:
Recommended packet:
Selected candidates:
Specialist owners:
Discovery artifact:
Zen hint:
Pattern hint:
Changes:
Verification:
Parked items:
Saturation status:
Recommended next action:
Shortcut:
```

For no-change runs:

```text
Entropy source:
Discovery intensity:
Selected candidates: none
Why no change:
Verification:
Parked items:
Next safe task:
```

## Stop Rules

Stop when either a ranked packet is delivered for selection or the loop
saturates with `Selected candidates: none`. Do not edit production code, move
files, delete tests, or rewrite guidance while the user is still asking what
should be cleaned.

After the user selects candidates, preserve the selection, likely owners, proof
commands, risks, parked items, and stop condition. Do not silently narrow the
selection to one small slice.

Use `references/detailed-guidance.md` for full rules on Zen ranking, pattern
fit, layout routing, delegation, canonical cleanup, decision policy, and
selection handoff.
