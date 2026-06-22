# Ranking And Routing

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
sequence before presenting the direction as decision-ready:

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
selection packet. Do not move files, delete tests, rewrite guidance, or edit
production code while the user is still asking what should be cleaned.

For a precise target where the user asks for implementation or deeper planning,
return the evidence, proof commands, execution risks, and stop condition so the
user can route it to their chosen next workflow. Keep newly discovered unrelated
ideas parked instead of letting the work expand by drift.

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
- a requested feature addition whose demand gate cannot show why a new surface
  is more valuable than reuse, narrowing, documentation, or deletion.
- a requested feature deletion or scope cut whose demand gate cannot show why
  keeping the behavior would mislead users, preserve stale surface, or violate
  current product/workflow intent.

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

In an active discovery loop, this same rule is the saturation check. If a fresh
round finds no P0/P1 or materially useful P2 candidate, mark the discovery
artifact as saturated or parked, record why the loop stopped, and do not invent
another cleanup direction merely to satisfy a requested count.

## Delegation Model

Keep the main session as the coordinator, decision point, and canonical
artifact editor. Use delegation to keep route evidence, worker logs, and
implementation detail out of the main context when the work naturally separates.

Follow the `$skill-runner` Codex delegation reference for worker selection. This
skill decides which discovery probes are worth delegating; the delegation
reference owns host-specific Paseo, native-subagent, model, and fallback rules.

Use `skill-runner` only for discovery probes or later selected work that is
stateful, interactive, long-running, artifact-sensitive, or better supervised
in a standalone tmux session. Prefer one mutating worker at a time in a single
worktree unless the write ownership is explicitly disjoint. Do not assume extra
git worktrees; many repos are too large or dependency-heavy for that to be the
default.

Worker handoff shape:

```text
Scope:
Changed files:
Decisions made:
Verification:
Open risks:
Suggested next action:
```

For delegated probes or later selected work, inspect the worker's structured
summary, compact artifacts, targeted logs, actual diff, and verification
evidence before trusting final status.

Model policy: prefer the current best/default model for normal delegated work.
Use smaller or quicker models only for truly easy probes where mistakes are
low-cost and easy to catch. Do not add multi-run orchestration here; leave
fan-out/fan-in runners for a later proven need.

## Canonical Cleanup Rule

Prefer the new intuitive API, path, module boundary, command shape, or folder
layout over backward compatibility. Architecture candidates should design for
the organized future at `HEAD`, not preserve old surfaces for their own sake.
When a selected cleanup/refactor direction is later implemented, old surfaces
are migration targets, not contracts.

- Update known in-repo callers, docs, tests, recipes, examples, CI, and command
  references to the new shape.
- Delete old wrappers, aliases, command paths, import paths, dead branches, and
  compatibility shims after known consumers are migrated.
- Do not ask whether to preserve compatibility as a generic architecture
  choice. If the user explicitly requests a temporary migration bridge, mark it
  as a tactical exception and record the removal trigger in the active plan,
  scope gate, or output report.
- If a broad command, install, or user-facing surface is affected, propose the
  forward migration/removal plan; do not default to a compatibility layer.

## Public Entry Model

Keep the reduce-entropy output focused on discovery and handoff, not
implementation:

- Routing precedence for overlapping cleanup prompts:
  unknown owner or "what should we clean" -> `$intuitive-reduce-entropy`;
  known code/API/module seam -> `$intuitive-refactor`;
  accepted direction without an execution contract -> `$intuitive-preflight`;
  approved execution contract or tiny concrete task -> `$intuitive-flow`.
- `$intuitive-reduce-entropy` -> find what repo maintenance would pay off most
  now, including thin read-only deletion/merge/canonical-owner discovery; name
  the discovery intensity, and recommend one next workflow action.
- `$intuitive-refactor` -> likely owner for known module, seam, API, or
  architecture cleanup targets after the target is named or a candidate packet
  is selected.
- `$intuitive-doc`, `$intuitive-init`, and `$intuitive-tests` -> likely owners
  for docs, agent guidance, and test-suite surfaces.
- `$grill-with-docs-batch`, `$intuitive-preflight`, implementation planning, or
  backlog parking may all be valid next steps after the user selects candidates,
  but the output should still choose the single best next action for the current
  packet.

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
- `$improve-codebase-architecture` owns optional extra report-only
  architecture/deepening candidate discovery when the review sequence still
  leaves no accepted target seam.
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
| Architecture discovery | open-ended architecture improvement, shallow modules, hard-to-test or hard-to-navigate code, unclear module depth or seams, request to find refactoring opportunities | Architecture Review Sequence first; optionally `$improve-codebase-architecture` in report-only mode; then `$intuitive-refactor` after a candidate is accepted |
| Known code cleanup | named module, accepted seam, stale API, compatibility shim, or target-local architecture cleanup | `$intuitive-refactor` |
| Workflow drift | unclear source of truth between plans, GSD, issues, docs, and commits | record the drift and likely next discussion/planning owner |

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
  `$improve-codebase-architecture` only if extra report-only candidate discovery
  is still needed.
- Mixed top-level surfaces, flat scripts/examples, agent-vs-human workspace
  separation, or unclear repo navigation -> keep the slice here and route
  subparts to the relevant specialist.

For any layout-shaped slice, keep the safety rules:

- move one bounded slice at a time
- find path consumers before proposing moves: imports, docs, CI, recipes,
  scripts, package metadata, hooks, and user-facing commands
- update known consumers to the new canonical path
- delete stale wrappers, aliases, old command paths, and old imports unless the
  user explicitly protects an external contract
- verify with stale-path searches and the narrow commands that exercise the new
  paths
