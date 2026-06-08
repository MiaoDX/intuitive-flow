---
name: intuitive-reduce-entropy
description: |
  Periodically inspect a repository and produce a ranked batch of high-value
  entropy reduction candidates across agent guidance, human docs, tests, repo
  layout, architecture depth, stale APIs, and cleanup gates. Use when the user
  says the repo feels messy, asks what to clean next, wants to make an old repo
  easier for humans and AI agents to work in, or wants maintenance suggestions
  without already knowing the target seam. This is the small public entrypoint
  for repo maintenance; it surfaces the serious group of cleanup opportunities
  first, then routes accepted candidates to specialist skills. It must return a
  no-change result instead of filling a requested count when only polish remains.
---

# Intuitive Reduce Entropy

Use this skill as the maintenance entrypoint when the user does not already know
which repo surface most needs cleanup. It diagnoses likely entropy sources,
recommends a ranked batch of bounded candidates, and routes accepted candidates
to the specialist skill that owns each slice.

The default goal is a repo where future agents can start quickly, humans can
review current truth from a small doc surface, tests show real behavior, and
the next meaningful task does not require rediscovering stale paths, bloated
agent files, mixed doc tiers, or unclear cleanup targets.

## Batch Discovery Default

Default to a batch-first audit, not a single-point recommendation. When the
user asks to "reduce entropy", "find cleanup", "make this repo easier to work
in", or gives no target surface, inspect broadly enough to return the serious
group of current candidates in one pass.

The expected first output is a ranked batch of 3-7 candidates when that many
pass the No-Change Outcome Rule. Use fewer only when the repo evidence only
supports fewer real findings. Do not hide the second- and third-best candidates
just because one candidate is clearly highest-value; showing the batch is what
makes the pass useful for periodic maintenance.

Each candidate should be decision-complete and pass the materiality contract:

```text
Candidate N: <short target>
Severity: <P0 | P1 | P2>
Entropy source: <source>
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

## Batch Execution Rule

Discovery and execution have different boundaries:

- Discovery should surface a ranked batch so the user does not need to ask many
  times to learn what is wrong.
- Execution should still apply one coherent slice at a time, with its own
  accepted checklist and verification, unless the user explicitly asks for a
  loop or multi-round cleanup.
- If the user asks to "run a loop", "do the top N", "do another N", "fix
  these", or otherwise approves execution, treat N as an upper bound, not a
  quota. Never fill unused slots with low-value work. Create or update one loop
  gate such as `docs/plans/refactor-reduce-entropy-loop.md`, list the accepted
  candidates or audit budget, run the deterministic materiality gate when the
  bundled script is available, then execute only candidates that still pass the
  No-Change Outcome Rule from the current repository state.
- In a multi-round loop, every round starts with a fresh audit from current
  HEAD. Stop early when the best remaining observation is only small polish,
  optional wording, or a change that would make the user wonder why another
  commit was needed.
- Treat open-ended prompts such as "continue until no more entropy remains",
  "keep reducing entropy", or `/goal` loops as saturation-sensitive. Do not
  turn them into a search for every possible cleanup commit. After the first
  strong batch is exhausted, stop unless the next candidate would still look
  worthwhile in a maintainer's review queue without referencing "consistency",
  "cleanup", or "nice to have" as the main justification.
- Before each additional group in a loop, run a saturation audit: name the next
  candidate, its materiality reason, and why it still deserves a commit after
  the previous groups. If that sentence is weak, stop with `Selected candidates:
  none`.
- Pause before broad file moves, deletes with uncertain consumers, public API
  changes, external compatibility removal, paid/slow/local-provider gates, or
  product-scope decisions even if they appear in the batch.
- After each executed candidate, update the loop gate and continue only while
  another accepted P0/P1 or materially useful P2 candidate remains in scope.

## Materiality Contract

Treat a candidate as eligible only when it prevents future surprise in a way a
reasonable maintainer would notice. At least one of these must be true:

- **False confidence**: a gate, test, script, link check, build, or report can
  pass while hiding a current broken or misleading state.
- **Live source drift**: two current sources of truth disagree about a live
  command, route, owner, public surface, or workflow.
- **Stale surface**: a live API, wrapper, command, generated output, index, or
  path remains reachable even though known in-repo consumers have moved.
- **Real workflow friction**: a future human or agent following current docs,
  commands, or scripts would likely hit an error, dead end, or rediscovery loop.
- **Recurring rediscovery**: the repo repeatedly forces agents to infer the same
  non-obvious rule because it is not encoded in docs, tests, gates, or structure.

These are not eligible by themselves:

- wording polish, punctuation, ordering, numbering, or formatting;
- a tiny index or route tweak that is only nicer, not less misleading;
- a test-only or documentation-only follow-up that merely supports a just-made
  implementation change;
- splitting helper tests, README notes, or report wording into their own
  "group" after the behavioral slice has already been counted;
- another possible refactor whose benefit is "cleaner" but not tied to a
  current surprise, false-green, stale surface, or repeated rediscovery.

Group supporting work with its parent slice. If a route parser changes, its
regression test belongs to the route-parser candidate. If a gate is strengthened,
the doc command update belongs to the gate candidate. Do not count supporting
tests or docs as separate entropy groups unless they independently satisfy the
eligible list above.

### Commit-Worthiness Gate

Materiality alone is not enough for an autonomous loop. A candidate also needs
enough impact to justify a standalone commit:

- `P0` and `P1` candidates are usually commit-worthy when they have current repo
  evidence and bounded risk.
- `P2` candidates are eligible only when they remove recurring rediscovery,
  unblock a real workflow, or are bundled with a higher-impact parent slice.
- Reject isolated P2 work whose main scope is a single-file metadata correction,
  starter template polish, route/index neatness, wording alignment, small date
  or status text cleanup, or a gate extension that only protects the change just
  made.
- A P2 candidate must include `Impact radius:` and `Maintainer test:`. If the
  maintainer test cannot explain the review value in one sentence without
  relying on "consistency" or "cleanup", park it.
- Prefer one no-change report with parked observations over a series of tiny
  commits. The skill succeeds when it stops correctly.

### Loop Deterministic Gate

When running an approved top-N loop, write the remaining accepted candidates to
JSON and run [scripts/materiality-gate.mjs](scripts/materiality-gate.mjs) before
executing the next group. Resolve the script relative to this `SKILL.md`, not
relative to the target repository. In Codex that is usually:

```bash
node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/materiality-gate.mjs" candidates.json
```

When working inside this source repo, this equivalent path is also valid:

```bash
node skills/intuitive-reduce-entropy/scripts/materiality-gate.mjs candidates.json
```

The gate is intentionally small: it cannot replace engineering judgment, but it
catches quota-filling, polish-only candidates, and supporting work counted as
standalone groups. If Node or the bundled script is unavailable, apply the same
candidate fields manually and explicitly say the deterministic gate was skipped.

Example:

```json
{
  "requested_groups": 5,
  "candidates": [
    {
      "id": "link-placeholder-gate",
      "title": "Reject placeholder links in scoped docs",
      "severity": "P1",
      "materiality": ["false_confidence"],
      "impact_radius": "workflow",
      "maintainer_test": "The docs gate can pass while publishing placeholder links, so reviewers need this protection before trusting link checks.",
      "evidence": ["link:check currently ignores [text](#) in scoped docs"]
    }
  ]
}
```

Run from this source repo:

```bash
node skills/intuitive-reduce-entropy/scripts/materiality-gate.mjs candidates.json
```

If it returns `stop_recommended: true`, stop before the requested count is
exhausted and report why the loop saturated.

## Zen Of Python Bias

Rank cleanup candidates with an explicit Zen of Python-style bias. Prefer
maintenance slices that make the repo more obvious, readable, flat, explicit,
and unsurprising for the next human or agent.

- Prefer explicit current truth over implicit tribal knowledge.
- Prefer one obvious canonical path, command, API, or doc home over parallel
  near-equivalents.
- Prefer simple, direct structure over clever indirection, deep nesting, or
  special-case wrappers.
- Make exceptional compatibility, migration, or verification constraints
  explicit instead of hiding them behind silent fallbacks.
- Let practicality beat purity, but choose the practical slice that most reduces
  future rediscovery and surprise.
- If the best slice is not obvious after inspection, say so and show the
  tradeoff instead of forcing artificial certainty.

When presenting candidates, include a brief `Zen hint:` for each ranked
candidate that states which clarity principle the slice advances.

## Design Pattern Fit Bias

For code cleanup, architecture discovery, and refactor-shaped entropy, add a
design-pattern lens after the Zen lens. Some entropy slices are not just
"simplify this file"; they are places where a small, named pattern can make the
next change more local, explicit, and testable.

Use patterns only when the repo evidence shows recurring shape. Prefer direct
code when a pattern would add ceremony, naming overhead, or indirection without
removing meaningful complexity.

Good pattern-fit signals:

- Repeated conditional behavior by type, mode, provider, command, or format ->
  Strategy, Command, or polymorphic dispatch.
- Multi-step object construction, option normalization, or environment setup
  scattered across call sites -> Builder or Factory.
- Incompatible external APIs, tool runners, storage backends, or legacy command
  surfaces leaking into core code -> Adapter or Facade.
- Cross-cutting concerns such as logging, validation, caching, retries, or
  metrics tangled into business logic -> Decorator, middleware, or pipeline.
- Ordered transformation, validation, or handling stages with growing
  special-case branches -> Chain of Responsibility or pipeline.
- Domain state transitions encoded as loose booleans, string flags, or repeated
  switch blocks -> State pattern or an explicit state machine.
- Many observers, callbacks, event emitters, or UI updates wired manually ->
  Observer/pub-sub with clear ownership boundaries.

Bad pattern-fit signals:

- The code has one variation point, one caller, or one known implementation.
- A small function, direct data table, or local helper would make the behavior
  clearer than a named abstraction.
- The proposed pattern preserves obsolete compatibility instead of deleting or
  migrating it.
- The pattern name is doing more justification work than the actual evidence.

When presenting candidates, include a brief `Pattern hint:` for code or
architecture slices. Name the likely pattern and the concrete complexity it
would remove, or say `Pattern hint: no pattern; direct cleanup is clearer.`

## Architecture Review Sequence

For architecture-shaped entropy, public-contract drift, task/skill/profile
boundary questions, MCP/tool surface changes, lifecycle gates, data-flow
cleanup, or code seams where the module map is unclear, run an explicit review
sequence before recommending implementation:

1. `$zoom-out`: build a domain-language map of the relevant modules, callers,
   public contracts, data flow, and invariants. Use repo docs and code, not just
   intuition.
2. `$plan-eng-review` / `$gstack-plan-eng-review`: stress-test the proposed
   slice for architecture fit, data flow, edge cases, acceptance gates,
   verification level, performance/cost risk, and rollout risk. If the
   interactive AskUserQuestion variant is unavailable, apply the same review
   frame in prose and state that the interactive gate was unavailable.
3. `$intuitive-refactor`: only after the target seam, accepted checklist,
   evidence ladder, and stop condition are explicit.

Do not ask the user to choose these subskills for an architecture slice; the
sequence is part of this skill's default routing. You may skip a subskill only
when a current plan, ADR, or gate already contains equivalent evidence. If so,
cite the source and summarize the evidence instead of rerunning the same
discussion.

Architecture sequence output should be compact and reusable:

```text
Zoom-out map:
Eng-review recommendation:
Public contract / boundary:
Data flow:
Accepted seam:
Rejected alternatives:
Verification ladder:
Stop condition:
```

## Human/Agent Surface Rule

The default human-facing source of truth is intentionally small:

- `README.md`
- `ARCHITECTURE.md`
- `STATUS.md`
- `docs/human/**`

`AGENTS.md` and `CLAUDE.md` are agent-operational docs. Use them for startup
rules, local hazards, command pointers, and skill routing, but do not treat them
as human-authoritative project truth by default.

Agent planning, generated evidence, history, and working notes belong in
explicit agent/process surfaces such as `.planning/**`, `docs/plans/**`,
`docs/retrospectives/**`, `docs/status/active/**`, and `output/**` unless a
human doc intentionally promotes a specific artifact into current truth.

AI coding docs are agent/process-facing docs that help future coding agents but
do not need to be human project truth. Prefer `docs/agents/**` for durable
agent runbooks, repo-specific coding procedures, tool quirks, and long harness
notes. Prefer `.planning/**`, `docs/plans/**`, `docs/retrospectives/**`,
`docs/status/active/**`, and `output/**` for execution state, plans,
retrospectives, generated evidence, and proof artifacts.

## Bounded Proposal Rule

For broad or ambiguous cleanup, audit first and stop after a decision-complete
batch proposal. Do not move files, delete tests, rewrite guidance, or edit
production code until the target slice or accepted loop batch, accepted
checklist, evidence level, and stop condition are explicit.

For a precise target where the user asks for implementation, apply one coherent
vertical slice. For an approved loop, apply the accepted candidates one slice at
a time. Keep newly discovered unrelated ideas parked instead of letting the work
expand by drift.

## No-Change Outcome Rule

Treat "stable enough; no change needed" as a valid result. This skill must not
manufacture a maintenance slice just because the user asked for an entropy pass.
After inspection, recommend no change when the remaining observations are only:

- taste or wording polish that does not change routing, contracts, tests, or
  stop conditions;
- speculative future cleanup with no current friction;
- already-resolved issues covered by a current plan, ADR, gate, or recent
  verified change;
- another possible refactor that would not make the next human or agent
  materially less surprised.
- a tiny route, copy, formatting, or index tweak whose main value is aesthetic
  neatness rather than preventing rediscovery, false confidence, or real
  operational confusion.
- an isolated P2 issue with single-file impact, no recurring evidence, or no
  maintainer-test sentence that would justify a standalone review;
- a newly discovered micro-fix after several successful loop rounds, unless it
  is bundled with an already accepted higher-impact slice.

When no candidate passes that bar, stop with a no-change report instead of
asking the user to proceed. The shape is:

```text
Entropy source:
Selected candidates: none
Why no change:
Verification:
Parked items:
Next safe task:
```

In an active loop, this same rule is the saturation check. If a fresh round
finds no P0/P1 or materially useful P2 candidate, close the existing loop gate
as `DONE` or `PARK`, record why the loop stopped before the budget was spent,
and do not make another cleanup commit merely to satisfy the requested count.

## Delegation Model

Keep the main session as the coordinator, decision point, and canonical
artifact editor. Use delegation to keep route evidence, worker logs, and
implementation detail out of the main context when the work naturally separates.

Default matrix:

| Work type | Default executor |
| --- | --- |
| Read-heavy independent probes | native subagents |
| Verification-heavy log or test-output inspection | native subagents |
| Bounded disjoint edits | native worker subagents |
| Stateful, interactive, or long-running skill pipelines | `skill-runner` / tmux |
| Canonical source-of-truth edits and route decisions | main session |

Use native subagents by default when there are two or more independent
read-heavy, verification-heavy, or safely partitioned edit workstreams. For
mutating native workers, assign disjoint file or path ownership before launch
and require a compact handoff back to the main session.

Use `skill-runner` for downstream skill work that is stateful, interactive,
long-running, or better supervised in a standalone tmux session. Prefer one
mutating `skill-runner` worker at a time in a single worktree unless the write
ownership is explicitly disjoint. Do not assume extra git worktrees; many repos
are too large or dependency-heavy for that to be the default.

Worker handoff shape, whether native subagent or `skill-runner`:

```text
Scope:
Changed files:
Decisions made:
Verification:
Open risks:
Suggested next action:
```

For `skill-runner`, inspect `result.md`, `eval.md`, `last-message.md` when
available, targeted logs, the actual diff, and verification evidence before
trusting the worker's final status.

Model policy: prefer the current best/default model for normal delegated work.
Use smaller or quicker models only for truly easy probes where mistakes are
low-cost and easy to catch. Do not add multi-run orchestration here; leave
fan-out/fan-in runners for a later proven need.

## Canonical Cleanup Rule

Prefer the new intuitive API, path, module boundary, command shape, or folder
layout over backward compatibility. In an approved cleanup/refactor slice, old
surfaces are migration targets, not contracts.

- Update known in-repo callers, docs, tests, recipes, examples, CI, and command
  references to the new shape.
- Delete old wrappers, aliases, command paths, import paths, dead branches, and
  compatibility shims after known consumers are migrated.
- Keep compatibility only when the user explicitly protects it, a published
  external contract must remain live, or verification shows a non-migratable
  outside-repo consumer.
- If compatibility is kept, mark it temporary and record the removal trigger in
  the active plan, scope gate, or output report.

## Public Entry Model

Keep the user-facing choice small:

- `$intuitive-flow` -> default build/change entrypoint; routes tiny concrete
  work directly, cleanup/refactor work to `$intuitive-refactor`, and broad work
  through durable Flow.
- `$intuitive-refactor` -> clean a known module, seam, API, or architecture
  target.
- `$intuitive-reduce-entropy` -> find what repo maintenance would pay off most
  now.
- `$intuitive-planning-loop` -> run bounded autonomous planning scouts before a
  single user review packet.
- `$intuitive-squash` -> clean local agent commit history before handoff.

Specialist skills still exist, but the user should not need to pick one before
the repo has been diagnosed:

- `$intuitive-doc` owns human-facing docs and doc boundary drift.
- `$intuitive-init` owns `AGENTS.md`, `CLAUDE.md`, `docs/agents/**`, init
  discovery, hooks, skills, and MCP guidance.
- `$intuitive-tests` owns test taxonomy, behavior quality, markers, pruning,
  fixture/factory extraction, and test folder layout.
- `$intuitive-preflight` owns pre-execution contracts: context package, scope,
  non-goals, definition of done, verification, route, worker strategy, and
  main-session `/goal` wording.
- `$zoom-out` plus `$plan-eng-review` own the first architecture review pass:
  map the module/caller context, then stress-test the slice before execution.
- Host-installed `$improve-codebase-architecture` owns optional extra
  report-only architecture/deepening candidate discovery when the review
  sequence still leaves no accepted target seam.
- `$intuitive-refactor` owns known code/module/API cleanup targets and
  persistent refactor gates, including execution of an accepted architecture
  candidate.

## Entropy Sources

Classify the user's prompt and repo evidence into one or more entropy sources:

| Source | Signals | Owner |
| --- | --- | --- |
| Agent guidance | bloated or stale `AGENTS.md` / `CLAUDE.md`, missing harness, unclear commands, copied human project state | `$intuitive-init` |
| Human docs | stale README/architecture/status, missing current truth, generated evidence in human docs | `$intuitive-doc` |
| Tests | low-signal tests, unclear markers, brittle fixtures, flat or confusing test layout, flaky or slow defaults | `$intuitive-tests` |
| Repo surface layout | mixed human/agent/runtime/test/script surfaces, flat scripts/examples, misplaced files, stale path consumers | route by object; see Layout Routing |
| Architecture discovery | open-ended architecture improvement, shallow modules, hard-to-test or hard-to-navigate code, unclear module depth or seams, request to find refactoring opportunities | Architecture Review Sequence first; optionally host-installed `$improve-codebase-architecture` in report-only mode; then `$intuitive-refactor` after a candidate is accepted |
| Known code cleanup | named module, accepted seam, stale API, compatibility shim, or target-local architecture cleanup | `$intuitive-refactor` |
| Workflow drift | unclear source of truth between plans, GSD, issues, docs, and commits | `$intuitive-flow` or `$intuitive-refactor`, depending on whether work is planned or cleanup-shaped |

## Layout Routing

Layout is a symptom, not a standalone public skill. Route by the object being
organized:

- Human docs, doc tiers, generated evidence in docs, or doc indexes ->
  `$intuitive-doc`.
- Test folders, markers, fixtures, pruning, or test helper layout ->
  `$intuitive-tests`.
- Code/package/module/API layout, stale imports, wrappers, or compatibility
  surfaces -> `$intuitive-refactor`.
- Unclear module depth, shallow seams, or broad "find architecture cleanup"
  requests -> Architecture Review Sequence first; use
  host-installed `$improve-codebase-architecture` only if extra report-only
  candidate discovery is still needed.
- Mixed top-level surfaces, flat scripts/examples, agent-vs-human workspace
  separation, or unclear repo navigation -> keep the slice here and route
  subparts to the relevant specialist.

For any layout-shaped slice, preserve the old safety rules:

- move one bounded slice at a time
- find path consumers before proposing moves: imports, docs, CI, recipes,
  scripts, package metadata, hooks, and user-facing commands
- update known consumers to the new canonical path
- delete stale wrappers, aliases, old command paths, and old imports unless the
  user explicitly protects an external contract
- verify with stale-path searches and the narrow commands that exercise the new
  paths

## Default Route

Use this route unless the user already names a specific entropy source.

1. **Orient**: launch parallel native probes for root guidance, human docs,
   package/test config, automation, top-level layout, and the current
   verification command when two or more surfaces need inspection. For tiny
   repos or precise prompts, inspect the relevant surface directly.
2. **Classify**: map observed friction to the entropy sources above.
3. **Recommend batch**: present the ranked candidate batch by default, normally
   3-7 candidates. Include a recommended execution order and attach `Zen hint:`,
   `Pattern hint:`, affected paths, owner skill, proof commands, and execution
   risk to each candidate. If only one candidate passes the No-Change Outcome
   Rule, present a batch of one and briefly say why other observations were
   parked. If no candidate passes, report `Selected candidates: none` and stop.
4. **Architecture sequence**: when the best slice is architecture/deepening,
   public-contract cleanup, MCP/tool boundary cleanup, lifecycle gates, or an
   unclear target seam, run `$zoom-out` and `$plan-eng-review` before execution.
   If no target seam has been accepted after that, optionally route to
   host-installed `$improve-codebase-architecture` in report-only mode. Treat
   all discovery output as candidate evidence, not execution approval, and keep
   it in the ranked batch unless the user already accepted the architecture
   candidate.
5. **Gate**: if execution is requested, use `$intuitive-refactor` to create or
   update one persistent maintenance gate for a single accepted target, normally
   `docs/plans/refactor-reduce-entropy-<target>.md`; for an approved multi-round
   cleanup, create or update a loop gate such as
   `docs/plans/refactor-reduce-entropy-loop.md` with the accepted candidate list
   or maximum audit budget, execution order, proof commands, and stop
   condition. The stop condition must say the loop may finish before the budget
   is exhausted when a fresh round returns `Selected candidates: none`.
6. **Route**: run the specialist owner for each accepted candidate, or keep the
   slice here only when it spans mixed repo surfaces without a narrower owner.
7. **Verify and close**: run the repo's relevant checks after each executed
   candidate, update the gate status, and park remaining cross-seam ideas.

Before routing to a specialist, produce a compact handoff packet so the next
stage does not repeat the whole audit:

```text
Accepted candidate:
Entropy source:
Zen hint:
Pattern hint:
Zoom-out map (architecture-shaped slices only):
Eng-review recommendation (architecture-shaped slices only):
Evidence:
Affected paths:
Discovery skill:
Architecture packet (architecture-shaped slices only):
Owner skill:
Proof commands:
Parked items:
Stop condition:
```

For long or stateful specialist execution, pass that packet through
`skill-runner`/tmux and have the main session inspect `result.md`, `eval.md`,
worker output, the actual diff, and verification before closeout.

Run another slice only when the accepted loop gate still has a concrete P0/P1
or materially useful P2 candidate inside scope. Do not repeat just because more
possible cleanup exists, and do not downgrade the materiality bar after several
successful rounds.

## User Input Routing

If the user names a likely area, route directly:

- "docs", "README", "ARCHITECTURE.md", "architecture docs", "status",
  "human docs" ->
  `$intuitive-doc`.
- "AGENTS", "CLAUDE", "harness", "init", "MCP", "hooks", "skills setup" ->
  `$intuitive-init`.
- "tests", "pytest", "coverage", "fixtures", "flaky", "markers" ->
  `$intuitive-tests`.
- "improve architecture", "architecture cleanup", "deepening", "shallow
  module", "hard to test", "hard to navigate", "find refactoring
  opportunities", "public contract", "MCP", "tool surface", "lifecycle gate" ->
  run the Architecture Review Sequence first. Use host-installed
  `$improve-codebase-architecture` only when extra report-only candidate
  discovery is still needed after `$zoom-out` and `$plan-eng-review`.
- "module", "API", "compatibility", "seam", "stale wrapper", "known
  architecture target" ->
  `$intuitive-refactor`.
- "layout", "folders", "scripts", "examples", "repo structure" -> inspect the
  object first, then route through Layout Routing.

If the user gives no area, do not guess silently. Return a ranked batch:

```text
Recommended batch:
1. <candidate> — <severity>, <owner>, <why now>
2. <candidate> — <severity>, <owner>, <why now>
3. <candidate> — <severity>, <owner>, <why now>

Recommended execution order:
- <candidate ids, with reason>

Parked items:
- <speculative or lower-value observations>

Suggested proof:
- <commands/searches>

Proceed with candidate <N>, or run up to the top <N> as a loop?
```

## Decision Policy

Auto-select a default candidate order only when repo evidence makes it
low-risk and reversible. Pause for the user when a decision would materially
change:

- runtime behavior or public APIs
- externally documented command/import paths
- broad file moves, deletes, or test pruning
- compatibility shims that may have outside-repo consumers
- paid, slow, Docker, hardware, simulator, or local-provider verification gates
- product intent, audience, or scope

If the user asks for "choose defaults," interpret that as permission to choose
mechanical defaults, not permission to cross these pause points silently.

## Stop Condition

Stop when all of these are true:

- the accepted maintenance gate or loop gate is `DONE` or `PARK`, with
  remaining ideas recorded
- either a ranked candidate batch was delivered for selection, or the accepted
  execution loop completed the approved candidates or saturated early with
  `Selected candidates: none`
- specialist skills were used for their owned surfaces instead of duplicating
  their full procedures here
- verification commands pass, or skipped gates are documented with a concrete
  reason
- the agent can state the next safe task without starting another broad cleanup
  sweep
- no-change runs explicitly say `Selected candidates: none` and do not create a
  gate, commit, or follow-up refactor proposal

## Report Format

End with:

```text
Entropy source:
Recommended batch:
Accepted candidate or loop:
Specialist owner:
Gate:
Zen hint:
Pattern hint:
Architecture packet (architecture-shaped slices only):
Changes:
Verification:
Parked items:
Next safe task:
```

For no-change runs, use:

```text
Entropy source:
Selected candidates: none
Why no change:
Verification:
Parked items:
Next safe task:
```
