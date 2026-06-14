---
status: IMPLEMENTED
created: 2026-06-14
last_reviewed: 2026-06-14
last_verified: 2026-06-14
plan_scope: intuitive-skill-context-slimming
accepted_severities:
  - P1
  - P2
---

# Intuitive Skill Context Slimming

## Status

IMPLEMENTED

## Problem

Recent Codex sessions against downstream repos showed faster context-window
saturation after broad intuitive-family workflows triggered. The main causes
were not only target-repo documentation or model behavior:

- broad command output entered the main transcript during discovery loops;
- repo startup guidance was sometimes consumed twice, once through host
  injection and once through mandatory full-file reads;
- several intuitive-family `SKILL.md` entrypoints are large enough that merely
  triggering the skill loads long operational detail before target-repo evidence
  is read.

The existing architecture already chooses progressive disclosure: `SKILL.md`
should be the compact entrypoint, conditional detail belongs in `references/`,
deterministic mechanics in `scripts/`, and reusable output shapes in
`templates/`. This plan executes that existing contract. It does not introduce
a new skill architecture.

## Target

Slim the high-traffic intuitive-family skill entrypoints under `skills/` while
preserving behavior, trigger semantics, scripts, output contracts, and install
sync behavior.

Priority order:

1. `skills/intuitive-reduce-entropy/SKILL.md`
2. `skills/intuitive-flow/SKILL.md`
3. `skills/intuitive-init/SKILL.md`
4. `skills/intuitive-doc/SKILL.md`
5. `skills/intuitive-refactor/SKILL.md`

Other repo-owned skills are out of scope unless a small shared reference or
check must change to support the target skills.

## Current Evidence

Current entrypoint sizes:

| Skill | Size |
| --- | ---: |
| `intuitive-reduce-entropy` | 37,733 chars / 814 lines |
| `intuitive-flow` | 28,576 chars / 496 lines |
| `intuitive-init` | 25,766 chars / 532 lines |
| `intuitive-doc` | 20,435 chars / 353 lines |
| `intuitive-refactor` | 18,030 chars / 448 lines |

The current source of truth is `skills/`, not an old `skills-src/` generation
layer. Historical plans that mention `skills-src/` are treated as shipped
history, not current implementation guidance.

Implemented entrypoint sizes:

| Skill | Size |
| --- | ---: |
| `intuitive-reduce-entropy` | 7,564 chars / 199 lines |
| `intuitive-flow` | 6,527 chars / 146 lines |
| `intuitive-init` | 4,581 chars / 106 lines |
| `intuitive-doc` | 3,204 chars / 93 lines |
| `intuitive-refactor` | 3,941 chars / 93 lines |

## Accepted Decisions

- Keep the work limited to the intuitive-family skills listed above for the
  first pass.
- Continue editing `skills/` directly. Do not restore `skills-src/` or add a
  generated-skill authoring layer in this slice.
- Treat `SKILL.md` size as a budgeted entrypoint concern, not a goal to delete
  capability.
- Use progressive disclosure: move rare, conditional, or long explanation into
  one-level `references/*.md`; keep scripts in `scripts/`; keep output shapes in
  `templates/`.
- Do not run `./scripts/update.sh` as part of the source refactor by default.
  Source changes are verified in-repo first; user-level skill installation sync
  is a separate explicit step.
- No ADR is required. This is execution of the existing skill contract, not a
  new public architecture decision.

## Non-Goals

- Do not merge the intuitive skills into one umbrella skill.
- Do not change skill names, frontmatter names, default allowlist membership, or
  public trigger semantics.
- Do not remove current scripts, templates, or behavior-specific output shapes.
- Do not broaden the pass to `skill-runner`, `grill-with-docs-batch`,
  `multica-goal-tracker`, or GStack/GSD wrappers.
- Do not silently mutate `~/.codex`, `~/.claude`, `~/.agents`, or other
  user-level install surfaces.

## Execution Plan

### Phase 1: Inventory And Budgets

- Record current chars and line counts for all target skills.
- Classify each long section as one of:
  - core route/invariant;
  - conditional reference;
  - reusable output/template;
  - deterministic script mechanics;
  - duplicate family policy.
- Identify any current `references/`, `templates/`, or `scripts/` that can
  absorb detail without new files.

### Phase 2: Slim `intuitive-reduce-entropy`

- Keep the entrypoint focused on:
  - when to use the skill;
  - batch discovery default;
  - materiality and no-change gates;
  - high-noise surface rule;
  - which reference to read for loops, architecture-shaped candidates, output
    packet shapes, and delegation.
- Move long examples, full packet templates, architecture review sequence
  detail, layout routing detail, and repeated policy prose into references.
- Preserve script references for high-noise summary, bounded command summary,
  and materiality gate.

### Phase 3: Slim `intuitive-flow`

- Keep routing, stop gates, and high-level execution ladder in the entrypoint.
- Move long route variants, output templates, checkpoint policy, and closeout
  detail into existing or new references.
- Preserve current reference table semantics so agents still know which detail
  to read next.

### Phase 4: Slim `intuitive-init`, `intuitive-doc`, And `intuitive-refactor`

- Apply the same entrypoint/reference split while preserving each skill's owner
  boundary.
- Avoid moving details into shared references unless at least two target skills
  already duplicate the same rule and a shared reference reduces future drift.
- Keep rare setup detail, edge-case docs policy, and large refactor gate
  examples outside the default entrypoint.

### Phase 5: Add Budget Visibility

- Extend `bun run check:skills` or add a companion report so maintainers can see
  `SKILL.md` size drift for repo-owned skills.
- Start with warning/report behavior and an allowlist for intentionally large
  entries. Do not hard-fail CI until the first slimming pass is complete and the
  threshold is proven practical.

Suggested initial target:

- target: primary runtime entrypoints should aim for <= 300 lines or <= 18,000
  chars;
- exception: a larger entrypoint is allowed only when the excess is justified in
  the report and has a follow-up split plan.

## Verification

Required source verification:

```bash
bun run check:skills
bun run test
bun run verify
```

Verified on 2026-06-14:

```bash
bun run verify
```

Result: pass. The verifier ran `check:skills`, ShellCheck, TypeScript checking,
and 131 Bun tests. `check:skills` now prints a non-failing size budget report
for all repo-owned skill entrypoints.

Required manual checks:

- Each moved reference is linked from the owning `SKILL.md` with a clear
  "read this when..." trigger.
- No `references/` link is broken.
- No public skill name, description intent, script path, template path, or
  default allowlist entry changes unless explicitly called out.
- The before/after size table shows meaningful reduction for each completed
  target skill.

Optional post-source sync, only after in-repo verification passes and the human
explicitly wants local install state updated:

```bash
./scripts/update.sh
```

## Stop Condition

Stop when:

- [x] all selected target skills have compact `SKILL.md` entrypoints or documented
  size-budget exceptions;
- [x] long conditional detail has moved into references/templates/scripts without
  changing behavior;
- [x] `bun run verify` passes;
- [x] the size report or equivalent budget visibility exists;
- [x] no user-level install surfaces were changed unless explicitly requested.

## Parked Items

- Add qualitative evals for behavior preservation across slimmed skills.
- Decide later whether size-budget warnings should become CI hard failures.
- Revisit non-intuitive repo-owned skills after the intuitive-family pass
  proves the pattern.
