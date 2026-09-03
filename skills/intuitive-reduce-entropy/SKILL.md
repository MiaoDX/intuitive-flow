---
name: intuitive-reduce-entropy
description: |
  Inspect a repository or plan and rank material simplification candidates.
  Use repo entropy mode when the cleanup owner is unknown, and plan entropy
  mode when an idea or plan needs blind spots found before approval. This skill
  discovers and routes work; it does not implement refactors.
---

# Intuitive Reduce Entropy

Use this skill to find a bounded set of changes that remove real maintainer or
execution friction. Prefer deletion, reuse, and one canonical owner over new
workflow, code, test, or documentation surfaces.

## Modes

| Mode | Use when | Output | Redirect when |
| --- | --- | --- | --- |
| Repo entropy | The repo feels messy, stale, hard to navigate, or has no known cleanup owner. | Ranked maintenance candidates and specialist owners. | A concrete seam is already selected; use its specialist or `$intuitive-refactor`. |
| Plan entropy | An idea, draft plan, or preflight needs missing decisions, weak assumptions, scope leaks, or proof gaps found. | Ranked plan risks and the next planning owner. | The contract is already approved; use `$intuitive-flow`. |
| Discovery loop | The user asks to continue until meaningful cleanup saturates. | Fresh bounded rounds with deduplicated clear, parked, and rejected items. | A selected queue is ready for `$intuitive-refactor`. |

Before auditing, state:

```text
Selected mode:
Why:
Redirect:
Discovery intensity: <quick scan | selection scan | saturation scan>
```

## Read First

Load only the reference needed for the active pass:

| Need | Read |
| --- | --- |
| Mode selection, discovery-loop behavior, plan-ledger boundaries | `references/discovery-modes.md` |
| High-noise summaries, materiality gate, no-change threshold | `references/high-noise-and-materiality.md` |
| Ranking, architecture review, delegation, specialist routing | `references/ranking-and-routing.md` |
| Candidate packet, user decision gates, handoff and final shapes | `references/handoff-and-reporting.md` |
| Reference index | `references/detailed-guidance.md` |

For broad repo scans, read the repo's thin orientation surface and run the
bundled high-noise summary before searching planning archives, logs, generated
trees, or other high-noise roots. Deep-read only enough to prove a candidate.

## Candidate Gate

Every selected candidate must pass both gates:

1. Demand sanity: the change deserves to exist now. For additions, explain why
   reuse, narrowing, deletion, or documentation cannot achieve the outcome. For
   removals, show why preserving the surface is stale, misleading, or costly.
2. Materiality: evidence shows false confidence, live source drift, a stale
   reachable surface, real workflow friction, or recurring rediscovery.

Use `scripts/materiality-gate.mjs` when a deterministic gate helps compare a
batch. Scripts provide evidence; they do not override repo facts or a required
human decision.

Rank deletion and cleanup candidates in this order:

1. Stale surfaces with an active replacement.
2. Compatibility aliases, wrappers, or legacy paths without a live contract.
3. Duplicate owners for one concept, state envelope, fixture, or rule.
4. Pass-through modules and tests/docs that keep stale concepts alive.
5. Bounded source-of-truth or verification drift.

Formatting, line motion, speculative abstraction, and taste are not selected
candidates. Park work that needs product direction, public migration approval,
credentials, hardware, paid services, or unavailable proof.

## Ownership Boundary

- This skill owns discovery, ranking, evidence, and routing.
- `$intuitive-refactor` owns mutation of selected cleanup seams.
- `$intuitive-doc`, `$intuitive-init`, and `$intuitive-tests` own their
  specialist surfaces.
- `$grill-with-docs-batch` owns unresolved human/domain decisions.
- `$intuitive-preflight` owns the approved execution contract.
- `$intuitive-flow` starts only after that contract is approved.

Use the host's approved delegation policy for independent read-only probes.
Do not hardcode a host-specific worker surface here; on Codex, follow
`skills/skill-runner/references/codex-delegation.md` for the native-v2 probe and
fallback. Keep the main session responsible for ranking, architecture decisions,
and final synthesis.

## Stop And Handoff

Stop when a decision-complete ranked packet is ready, or when a saturation pass
finds no new material candidate. Do not silently select a subset or begin
implementation. If nothing passes, say `Selected candidates: none` and do not
create a gate, commit, or follow-up refactor proposal.

End with:

```text
Entropy source:
Discovery intensity:
Recommended packet:
Selected candidates:
Specialist owners:
Evidence and proof commands:
Parked items:
Saturation status:
Recommended next action:
Shortcut:
```
