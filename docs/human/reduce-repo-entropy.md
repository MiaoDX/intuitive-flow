# Reduce Repo Entropy

Use `$intuitive-reduce-entropy` in repo entropy mode when a repository needs
periodic maintenance before future AI-agent work. This is repo-operational
cleanup: agent guidance, human docs, tests, mixed surfaces, stale paths, and
bounded cleanup. It is not a database/schema migration unless you explicitly add
that scope.

Use plan entropy mode when the input is an idea, draft plan, or named
`docs/plans/<slug>.md` and the goal is to find blind spots before
`gstack-autoplan`, grill-batch, preflight, or `$intuitive-flow` execution.

Use the repo-wide maintenance goal prompt when the goal is not merely to find a
batch, but to keep finding and executing all clear architecture cleanup until
the current `HEAD` is saturated. The short prompt is the default when the
installed `$intuitive-refactor` skill is current; use the expanded fallback only
in environments where named skills are unavailable or stale.

## Repo-Wide Architecture Maintenance Goal Prompt

```text
/goal Use $intuitive-refactor to run the repo-wide architecture maintenance goal for the current repo until saturated.
```

Equivalent plain-language prompt:

```text
Use $intuitive-refactor to keep discovering and executing all clear, safe,
verifiable architecture cleanup in this repo. Use the repo-wide maintenance
goal loop, not the selected-slice campaign. Stop only after saturation finds no
new clear P1/P2 after parked and low-value registry deduplication.
```

## Expanded Fallback Prompt

Use this only when the environment does not have the current
`$intuitive-refactor` skill description and references installed.

```text
/goal Run a repo-wide architecture maintenance loop for the current repo.

Goal:
Periodically maintain the whole repo's architecture and cleanup surface. Keep
discovering and executing all clear, bounded, high-value architecture cleanup
that is safe and verifiable now. Do not stop after one candidate packet. Stop
only when a fresh saturation discovery round from current HEAD produces no new
clear P1/P2 candidate after parked and low-value items are deduplicated.

Route:
- Start by reading the repo's first-read guidance and human truth docs.
- Use $intuitive-reduce-entropy in repo entropy / discovery-loop mode for fresh
  maintenance handoffs.
- Use $intuitive-refactor to execute clear candidates.
- Use the campaign overlay's repo-wide maintenance goal loop, not the narrower
  selected-slice campaign stop rule.

Execution policy:
- Execute every clear candidate that is bounded, owner-backed, behavior-
  preserving or explicitly accepted, and verifiable with available focused
  proof.
- Prefer deletion, duplicate-owner merge, canonical owner move, stale-surface
  removal, and tests/docs updates that stop preserving stale concepts.
- After the clear queue is empty, run fresh discovery from current HEAD inside
  the same goal.
- Do not treat a new discovery handoff as a new independent goal.

State policy:
- Maintain one canonical gate under the repo's plan convention, plus an active
  capsule if the run is durable.
- Track:
  - clear queue
  - parked registry
  - rejected low-value registry
  - verification inventory
  - saturation stop rule
- Give every parked or rejected item a stable fingerprint:
  fingerprint, owner layer, park/reject reason, exact unblocker or materiality
  gap, first seen, last confirmed, do-not-reopen-unless.
- A rediscovered parked/rejected item updates `last_confirmed`; it is not a new
  blocker or new direction unless the unblocker, risk, owner, or evidence
  materially changed.

Stop / park policy:
- Park work needing human judgment, public API/CLI/schema/report migration,
  hardware/manual evidence, credentials, unavailable proof, or broad design.
- Reject low-value polish, taste, formatting, line shuffling, and weak
  materiality observations instead of executing them.
- Stop when the clear queue is empty and a saturation discovery round finds no
  new clear P1/P2 after registry deduplication.

Verification and commits:
- Use the smallest sufficient proof for each slice.
- Checkpoint after each meaningful slice or clear batch.
- Commit verified implementation slices when repo/user policy allows and the
  staged diff is only that slice plus matching gate/capsule updates.

Latest user intent still wins. If the user asks for discussion, status, pause,
or process review, switch to read-only control mode until execution is resumed.
```

## Repo Entropy Prompt

```text
Use $intuitive-reduce-entropy in repo entropy mode for this repo.

Goal: identify the ranked selection packet of high-value entropy reduction
candidates that would make the repo easier for future AI agents and humans to
work in without changing runtime behavior.

Start by classifying entropy sources:
- agent guidance and harness drift
- human docs and source-of-truth drift
- tests, fixtures, markers, or low-signal coverage
- mixed repo surfaces, scripts, examples, or stale paths
- open-ended architecture/deepening opportunities, shallow modules, or hard-to-test seams
- known stale APIs, wrappers, compatibility shims, or module seams

For narrow prompts, present the serious group of current candidates in one pass,
normally 3-7 items. For repo-wide prompts, old-repo cleanup, "as much as
possible", "all big directions", "again and again", or "continue until no
more" language, run discovery-loop mode: keep auditing fresh surfaces until no
P0/P1 or materially useful P2 directions remain. Rank candidates by severity,
evidence, and future surprise reduction. If fewer than 3 candidates pass the
bar, explain why the other observations are parked. Treat requested counts as a
maximum, not a quota. Stop with `Selected candidates: none` when only tiny
polish remains.

Only count a candidate when it has at least one materiality reason:
- false confidence in a gate, test, script, report, or build
- live source-of-truth drift
- stale reachable surface after consumers moved
- real workflow friction for a future human or agent
- recurring rediscovery that should be encoded in docs, tests, gates, or structure

Do not count wording polish, numbering, formatting, route/index niceties, or
supporting tests/docs as their own group. Bundle supporting tests and docs with
the behavior or gate change they protect. For open-ended discovery loops, write
candidate groups to JSON and run the installed skill's materiality gate when it
helps test whether the loop should stop:

```bash
node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/materiality-gate.mjs" candidates.json
```

When working inside the `intuitive-flow` source repo, this path is equivalent:

```bash
node skills/intuitive-reduce-entropy/scripts/materiality-gate.mjs candidates.json
```

If it reports fewer eligible candidates than requested, stop early instead of
filling the count.

For each candidate include:
- severity
- entropy source
- affected paths
- owner skill
- why now
- suggested proof
- execution risk

After discovery, do not pick the easiest first slice or implement a single
candidate by default. Ask the user to select all candidates, specific candidate
ids, none, or a subset for more discussion. The user may route selected
candidates to implementation, grill-batch discussion, preflight, another
planning loop, or backlog parking.

Record specialist owners in the selection packet:
- $intuitive-init for AGENTS.md, CLAUDE.md, docs/agents, hooks, MCP, or skills setup
- $intuitive-doc for README, ARCHITECTURE, STATUS, docs/human, or doc-tier drift
- $intuitive-tests for test taxonomy, markers, pruning, fixtures, or test layout
- zoom-out plus plan-eng-review/gstack-plan-eng-review for the first
  architecture review pass
- improve-codebase-architecture for optional report-only architecture discovery
  when no target seam is accepted yet
- $intuitive-refactor for known code/module/API cleanup targets or executing an accepted architecture candidate

Prefer aggressive cleanup inside accepted scope:
- remove stale compatibility wrappers after in-repo consumers are migrated
- keep README/ARCHITECTURE/STATUS/docs/human as the human truth
- keep planning/evidence/history out of the human surface
- preserve actual behavior unless a change is explicitly accepted

Ask only for decisions that materially change scope, risk, public APIs, deletes,
or external compatibility.
Leave commits, code edits, and per-candidate verification to a later selected
workflow unless the user explicitly changes the task from discovery to
implementation and confirms the selected set.
Stop when the selection packet is complete, the discovery loop is saturated, and
remaining ideas are parked.
```

## Plan Entropy Prompt

```text
Use $intuitive-reduce-entropy in plan entropy mode for this idea or plan:
<paste idea or path to docs/plans/<plan>.md>

Goal: identify missing decisions, weak assumptions, scope leaks, source-of-truth
drift, proof gaps, and hidden execution/test/DX risks before grill-batch,
preflight, or $intuitive-flow execution.

Start by saying:
Selected mode: plan entropy mode
Why: <one sentence tied to the prompt>

Inspect only the smallest context needed: the plan or idea text, referenced
human docs/context files, acceptance criteria, verification gates, and source
evidence named by the plan. Do not broaden into repo-wide maintenance unless
the plan itself depends on that surface.

For each candidate include:
- severity
- entropy source
- affected paths
- owner skill
- why now
- suggested proof
- execution risk

Classify likely next owner:
- $grill-with-docs-batch for unresolved decision quality, terminology, product,
  domain, or contract questions
- gstack-autoplan for an explicit unknown-unknown scout on non-trivial
  plan-backed work
- $intuitive-preflight when the plan is accepted but needs execution scope,
  acceptance, verification, stop gates, and worker strategy
- $intuitive-flow only after the plan/preflight contract is approved and
  reconciled into the canonical plan

Stop with `Selected candidates: none` when remaining points are implementation
defaults, weak polish, or already covered by the plan.
```

## Expected Outcome

After a successful repo entropy pass, the repo should have:

- a ranked selection packet of credible entropy candidates, or an explicit
  no-change report
- a discovery loop completed or saturated early when the prompt is repo-wide, or
  all candidates explicitly parked
- current human docs in `README.md`, `ARCHITECTURE.md`, `STATUS.md`, and
  `docs/human/**`
- agent guidance that points at the right docs and commands without bloated
  root files
- selected candidates ready for the user's chosen next workflow, with
  specialist owners, suggested proof, execution risks, and parked items recorded
- discovery verification recorded, with any skipped local-only gates explained
- remaining cleanup ideas parked instead of silently widening the scope

After a successful plan entropy pass, the plan should have either a short list
of material questions to resolve before execution or an explicit no-change
report that it is ready for grill-batch, preflight, or execution.
