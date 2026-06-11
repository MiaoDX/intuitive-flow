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
  first, records likely specialist owners for each candidate, and returns a
  selection packet for the user to choose from. It must return a no-change
  result instead of filling a requested count when only polish remains.
  It is a discovery and selection-packet skill; it should not prescribe the
  next workflow after the user selects all or part of the package.
---

# Intuitive Reduce Entropy

Use this skill as the maintenance entrypoint when the user does not already know
which repo surface most needs cleanup. It diagnoses likely entropy sources and
returns a ranked selection packet of bounded candidates. It should not choose a
"first cut", simplest slice, or favorite implementation target for the user.
After the user selects all or part of the packet, the next step is their choice:
more discussion, `$grill-with-docs-batch`, `$intuitive-preflight`,
implementation, or parking the work.

The default goal is a repo where future agents can start quickly, humans can
review current truth from a small doc surface, tests show real behavior, and
the next meaningful task does not require rediscovering stale paths, bloated
agent files, mixed doc tiers, or unclear cleanup targets.

## Batch Discovery Default

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

## Discovery Loop And Selection Handoff

Discovery and implementation have different boundaries:

- Discovery should surface the complete serious group of current candidates so
  the user can choose all, choose a subset, or defer everything with full
  context.
- Do not frame one candidate as "the first cut", "the easiest slice", or the
  skill's chosen implementation target. A recommended order is only planning
  guidance; it is not a selection.
- For narrow prompts, run one broad-enough pass and return the ranked batch.
- For repo-wide prompts, old-repo cleanup, "as much as possible", "all big
  directions", "again and again", "continue until no more", or similar
  saturation language, enter discovery-loop mode by default.
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
- For large loops, create or update one discovery artifact such as
  `docs/plans/refactor-reduce-entropy-loop.md` when the target repo convention
  allows planning docs. Record audit rounds, selected candidates, parked items,
  suggested proof, and the stop condition in that one artifact instead of
  scattering partial batches through chat.
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

## High-Noise Surface Budget

Do not solve a large repo by reading every historical or generated artifact.
Those surfaces often matter, but their cleanup value comes from current
confusion, live references, false confidence, or stale reachable entrypoints,
not from their size.

Apply this default budget before deep-reading:

- `.planning/**`, `docs/plans/**`, `tasks/**`, `.scratch/**`, retrospectives,
  and issue workspaces: index filenames, statuses, dates, owners, and current
  doc/code references first. Deep-read only the files needed to prove stale
  backlog drift, duplicated source-of-truth, or a live workflow trap.
- `tmp/**`, `output/**`, `logs/**`, generated evidence, snapshots, manifests,
  and local artifacts: check whether they are tracked, published, referenced by
  current docs/tests/scripts, or used as fixtures. If not, park them as local
  residue instead of expanding them.
- Very large tests, profile registries, generated constants, or data tables:
  inspect names, counts, ownership, import/caller references, and failing or
  false-green gates before reading long bodies. Deep-read only around a
  candidate seam.
- Vendored dependencies, submodules, virtualenvs, caches, egg-info, and build
  outputs: skip by default unless the repo explicitly owns that surface or a
  live command depends on it.

Useful first-pass commands are bounded `find`, `git ls-files`, `git status`,
`rg --files`, `rg -n <specific token> <specific paths>`, `git log -n`, and
small `sed` windows. Bound both the command and the printed result:

- For default broad discovery, run the bundled high-noise summary script before
  ad hoc directory scans:

  ```bash
  node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/high-noise-summary.mjs"
  ```

  When working inside this source repo, this equivalent path is also valid:

  ```bash
  node skills/intuitive-reduce-entropy/scripts/high-noise-summary.mjs
  ```

  Run it from the target repository root. The script includes common historical
  and generated surfaces plus large `tests`/`test` and `profiles` surfaces when
  present. Use `--surface <path>` for a narrowed probe and `--examples N` when
  fewer examples are enough. If the script is not available, produce the same
  summary shape manually; do not substitute a long custom `find`,
  `git ls-files`, or `rg --files` listing.
- Do not include high-noise roots in broad path-listing commands such as
  `rg --files gr00t_manipulation scripts tests docs .planning .scratch specs`
  or `find .planning docs/plans ...`. Use the summary script for those roots,
  then run targeted `rg -n <specific token> <specific paths>` or a small `sed`
  window only after a candidate needs proof.
- prefer counts, grouped summaries, and 5-20 representative examples over long
  path lists;
- print at most the first screen of any index, then switch to targeted
  reference searches;
- for large markdown or tests, read headings/status/top matter first, then only
  the narrow window around the candidate evidence;
- if a command reports `Broken pipe`, truncates a huge list, or produces mostly
  filenames without a candidate, treat that as a budget signal and stop the
  scan.

Avoid broad `rg` or `cat` commands whose output is mostly old plans, generated
data, or full test/profile bodies. If the next probe would mostly increase
transcript size instead of candidate confidence, stop and report the candidate,
parked observation, or saturation reason.

Exploratory verification commands can be high-noise too. For full test
collection, broad `pytest -q`, wide linters, generated-report checks, or any
command likely to print many test IDs, paths, warnings, or JSON rows, save the
full output to a temp log and print only a bounded summary. Prefer the bundled
summary runner over hand-written shell snippets:

```bash
node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/bounded-command-summary.mjs" \
  --kind generic --timeout 180 -- \
  <command> <args...>
```

Use the full temp log only for targeted follow-up. Do not paste hundreds of
collected test names, generated rows, or repeated warnings into the transcript
when the candidate only needs failure type, count, and a few representative
lines.

For `pytest --collect-only`, use the pytest-specific mode. It omits the raw
tail because the tail often still contains many node IDs:

```bash
node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/bounded-command-summary.mjs" \
  --kind pytest-collect --timeout 180 -- \
  env PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 <pytest collect command>
```

If a tiny sample of collected node IDs is relevant, print at most 10 with a
purpose-specific grep. Never print the full collection list.

When using `bash -lc`, quote search patterns for the shell that will run `rg`.
Backticks inside double quotes are still command substitutions; prefer fixed
string probes such as `rg -n -F -e 'sonic_native' -- docs .planning` or single
quoted regex patterns. Do not put markdown-code tokens like `` `name` `` inside
double-quoted `rg` patterns.

When a high-noise surface produces a candidate, include the evidence chain:

```text
Surface:
Why this surface is live:
Small evidence sampled:
Deep-read trigger:
Candidate or parked reason:
```

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

When validating an open-ended discovery loop, write the candidate groups to JSON
and run [scripts/materiality-gate.mjs](scripts/materiality-gate.mjs) before
adding another group to the selection packet. Resolve the script relative to
this `SKILL.md`, not relative to the target repository. In Codex that is
usually:

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
exhausted and report why the discovery loop saturated.

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

Follow `$skill-runner`'s Codex delegation policy. On Codex, keep tiny probes in
the main session, use Paseo-managed agents for parallel read-heavy scouts,
review passes, verification/log probes, and short bounded independent tasks
when the Paseo MCP surface is available and a no-edit provider/model probe
succeeds, and use `skill-runner`/tmux when durable artifacts or stronger
isolation are worth it. Do not use native Codex subagents by default. On stable
non-Codex hosts, native subagents are acceptable for independent probes or
explicitly disjoint edits.

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

For Paseo-managed agents, require a structured final summary and inspect
`get_agent_activity` plus `get_agent_status` before trusting the worker's final
status. For `skill-runner`, inspect `result.md`, `eval.md`, `last-message.md`
when available, targeted logs, the actual diff, and verification evidence
before trusting the worker's final status.

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

Keep the reduce-entropy output focused on discovery, not on choosing the next
workflow:

- `$intuitive-reduce-entropy` -> find what repo maintenance would pay off most
  now.
- `$intuitive-refactor` -> likely owner for known module, seam, API, or
  architecture cleanup targets.
- `$intuitive-doc`, `$intuitive-init`, and `$intuitive-tests` -> likely owners
  for docs, agent guidance, and test-suite surfaces.
- `$grill-with-docs-batch`, `$intuitive-preflight`, implementation planning, or
  backlog parking may all be valid next steps after the user selects candidates.

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
  host-installed `$improve-codebase-architecture` only if extra report-only
  candidate discovery is still needed.
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

## Default Route

Use this route unless the user already names a specific entropy source.

1. **Orient**: launch parallel native probes for root guidance, human docs,
   package/test config, automation, top-level layout, and the current
   verification command when two or more surfaces need inspection. For tiny
   repos or precise prompts, inspect the relevant surface directly. For broad
   prompts, run the high-noise summary preflight before searching `.planning`,
   `docs/plans`, `.scratch`, generated/log/tmp surfaces, large tests, or
   profile registries. For high-noise surfaces, orient with indexes and
   references rather than full-body reads.
2. **Classify**: map observed friction to the entropy sources above.
3. **Choose discovery depth**: for narrow prompts, run one broad-enough pass.
   For repo-wide or saturation language, run discovery-loop mode and record the
   rounds in one artifact when the repo convention allows it. Each round should
   name the surface, bounded probes used, candidate-level evidence found, parked
   observations, and why deeper reading did or did not continue.
4. **Recommend packet**: present the complete ranked candidate packet. Include a
   suggested review order and attach `Zen hint:`, `Pattern hint:`,
   affected paths, owner skill, proof commands, and execution risk to each
   candidate. If only one candidate passes the No-Change Outcome Rule, present a
   packet of one and briefly say why other observations were parked. If no
   candidate passes, report `Selected candidates: none` and stop.
5. **Architecture sequence**: when any candidate direction is
   architecture/deepening,
   public-contract cleanup, MCP/tool boundary cleanup, lifecycle gates, or an
   unclear target seam, run `$zoom-out` and `$plan-eng-review` before
   presenting it as decision-ready.
   If no target seam has been accepted after that, optionally route to
   host-installed `$improve-codebase-architecture` in report-only mode. Treat
   all discovery output as candidate evidence, not execution approval, and keep
   it in the ranked packet unless the user already selected the architecture
   candidate.
6. **Selection packet**: when the user selects all or part of the packet,
   preserve the selected candidates, suggested review order, likely specialist owners,
   proof commands, execution risks, parked items, and stop condition. Do not
   silently narrow the selected set to one small slice.

When the user asks for a compact selected-candidates packet, use this shape so
the next stage does not repeat the whole audit:

```text
Selected candidates:
Entropy source:
Zen hint:
Pattern hint:
Zoom-out map (architecture-shaped slices only):
Eng-review recommendation (architecture-shaped slices only):
Evidence:
Affected paths:
Discovery skill:
Architecture packet (architecture-shaped slices only):
Owner skills:
Proof commands:
Parked items:
Stop condition:
```

The user may route the selected packet to implementation, `$grill-with-docs-batch`,
`$intuitive-preflight`, another planning loop, or simply keep it as a backlog.
Do not assume which route they will choose.

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

If the user gives no area, do not guess silently. Return a ranked packet:

```text
Recommended packet:
1. <candidate> — <severity>, <owner>, <why now>
2. <candidate> — <severity>, <owner>, <why now>
3. <candidate> — <severity>, <owner>, <why now>

Suggested review order:
- <candidate ids, with reason>

Parked items:
- <speculative or lower-value observations>

Suggested proof:
- <commands/searches>

Select all, select specific candidate ids, discuss selected candidates further,
or park the packet.
```

## Decision Policy

Suggest a review order only when repo evidence makes the ordering clear. Do not
auto-select the subset to implement. Pause for the user when a
decision would materially change:

- runtime behavior or public APIs
- externally documented command/import paths
- broad file moves, deletes, or test pruning
- user-requested temporary compatibility bridges or broad migration removals
- paid, slow, Docker, hardware, simulator, or local-provider verification gates
- product intent, audience, or scope

If the user asks for "choose defaults," interpret that as permission to choose
mechanical defaults, not permission to cross these pause points silently.

## Stop Condition

Stop when all of these are true:

- either a ranked candidate packet was delivered for selection, or a discovery
  loop saturated with `Selected candidates: none`
- specialist skills were used for their owned surfaces instead of duplicating
  their full procedures here
- verification commands pass, or skipped gates are documented with a concrete
  reason when verification was part of the discovery task
- the agent can state the next safe task without starting another broad cleanup
  sweep
- no-change runs explicitly say `Selected candidates: none` and do not create a
  gate, commit, or follow-up refactor proposal

## Report Format

End with:

```text
Entropy source:
Recommended packet:
Selected candidates:
Specialist owners:
Discovery artifact:
Zen hint:
Pattern hint:
Architecture packet (architecture-shaped slices only):
Changes:
Verification:
Parked items:
Next options:
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
