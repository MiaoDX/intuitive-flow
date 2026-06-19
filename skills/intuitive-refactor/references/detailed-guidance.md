# Intuitive Refactor

Use this skill to set the goal, scope, evidence, and stop condition for a
bounded refactor before code changes start. Once a target slice is accepted, the
default posture is aggressive cleanup: move callers to the new intuitive API,
layout, or module boundary and remove stale compatibility surfaces.

This workflow owns the scope gate and stop condition. Architecture scanners,
TDD, diagnosis, or planning workflows are optional inputs: use them when they
raise evidence quality, but keep the accepted checklist and stop condition here.
When no specialist workflow is needed, gather repo context directly and proceed
against the same gate.

## Operating rule

Start with a scope gate. For broad or ambiguous requests, make the first pass
report-only. When the user names a bounded target and asks for execution, treat
that as approval to clean the target up aggressively.

Do not edit production code until all of these are explicit:

- the target module or seam
- the accepted issue checklist
- which issue severities are in scope, defaulting to P0/P1/P2 inside the target
- the required evidence level
- the stop condition
- the persistent gate file, if this is more than advice

The goal is not "no more possible refactors." Any healthy project will always
have possible refactor points. The goal is "the accepted checklist inside the
target is green, the new API/layout is canonical, and cross-seam ideas are
parked instead of implemented by drift."

Start refactors from pressure, not possibility. Good triggers are current
breakage, repeated friction, an active task blocked by stale structure,
source-of-truth drift, false-green verification, public-contract drift, or a
user-named bounded cleanup target. "This could be cleaner" is a parked idea
until it blocks work or the user explicitly scopes that cleanup.

## Bounded Proposal Rule

For broad or ambiguous cleanup, audit first and stop after a decision-complete
proposal. Do not move files, delete tests, rewrite guidance, or edit production
code until the target slice, accepted checklist, evidence level, and stop
condition are explicit.

For a precise target where the user asks for implementation, apply one coherent
vertical slice. Keep newly discovered unrelated ideas parked instead of letting
the work expand by drift.

## Architecture Packet Rule

For refactors that touch architecture seams, public APIs, public contracts,
task/skill/profile boundaries, MCP/tool surfaces, lifecycle gates, data flow, or
runtime behavior, require an architecture packet before production edits. The
packet must come from either:

- the current turn's `$zoom-out` map plus `$plan-eng-review` /
  `$gstack-plan-eng-review` findings; or
- an existing plan, ADR, or refactor gate that already contains equivalent
  evidence and can be cited.

If the packet is missing, run `$zoom-out` first and then `$plan-eng-review`
before producing the refactor scope gate. If the interactive gstack review gate
is unavailable, apply the same engineering-review frame in prose and record the
tool limitation.

Minimum architecture packet shape:

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

## Canonical Cleanup Rule

Prefer the new intuitive API, path, module boundary, command shape, or folder
layout over backward compatibility. Architecture design should never keep an
old surface merely because it exists. In an approved cleanup/refactor slice, old
surfaces are migration targets, not contracts.

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

If the user asks for a full autonomous run, continue only through safe,
deterministic gates. Pause before local-only, paid-provider, Docker/Gateway, or
human-judgment gates unless the user explicitly authorized them.

## Persistent state rule

Skills are not stateful by themselves. Chat history, agent memory, and previous
command output are not reliable stop conditions across repeated runs. Persist
the refactor gate in the repo when the user asks for execution, repeated runs,
or "all big known issues."

For durable or repeated execution, also maintain the shared active capsule from
`../../_shared/references/durable-run.md` at `docs/status/active/<gate-slug>.md`;
create `docs/status/active/` when it is missing. The gate remains canonical for
scope/status/checklist, while the capsule is only the compact resume surface.

Use one source of truth:

- If a relevant `docs/plans/<slug>.md` already exists, update that file.
- Otherwise create `docs/plans/refactor-<target-slug>.md`.
- Do not create a second active plan for the same seam.
- Do not use `~/.gstack`, temporary logs, chat memory, or commit history as the
  handoff source of truth. They can be evidence, not the gate.

The gate file must mark its status explicitly. Use these exact status values:

- `DONE` — accepted checklist is complete and evidence is still green.
- `CONTINUE` — accepted P0/P1 item remains incomplete.
- `REOPEN` — user explicitly expanded scope or new evidence shows a P0/P1
  regression. A concrete repeated failure from real usage also counts as new
  evidence.
- `PARK` — no active target-local cleanup remains; only cross-seam or future
  ideas exist.

When creating or updating the gate file, write the status in both places:

- YAML frontmatter `status: <DONE|CONTINUE|REOPEN|PARK>` for quick parsing
- `## Status` for human scanning

The gate file should contain this shape:

```markdown
---
refactor_scope: <target-slug>
status: CONTINUE
accepted_severities:
  - P0
  - P1
  - P2
last_verified: null
---

# Refactor Scope: <target>

## Status

CONTINUE

## Target

## Accepted Severities

## Accepted Cleanup Checklist

## Parked Cross-Seam / Future Ideas

## Evidence Ladder

## Stop Condition

## Execution Log
```

On a repeated run, read the existing gate file first. Check the frontmatter
`status` first, then `## Status` if the frontmatter is missing. Classify the
current state as:

- **DONE** — accepted checklist is complete and evidence is still green; stop.
  Park P2-only wording, taste, or "could be cleaner" findings unless the user
  explicitly names that slice for cleanup.
- **CONTINUE** — accepted cleanup item remains incomplete; continue that item.
- **REOPEN** — the user explicitly expands scope or new evidence shows a P0/P1
  regression; update the same gate file.
- **PARK** — only cross-seam or future ideas remain; record them and stop.

## Severity gate

Classify every finding before implementation:

| Severity | Meaning | Default action |
| --- | --- | --- |
| P0 | Current breakage, data loss, security exposure, deploy failure, or a verifier that gives false green on real failure | Fix now |
| P1 | A real correctness, source-of-truth, testability, or required code-intelligence gap that can hide failure in the named seam | Fix now |
| P2 | Maintainability, duplication, naming, drift risk, stale API surface, compatibility shim, or "this could be cleaner" inside the accepted target | Fix by default when it simplifies the target |
| Parked | Speculative, cross-seam, broad cleanup, taste preference, or future-proofing outside the accepted target | Record only |

When the user's prompt says "all big known issues," interpret "big" as P0/P1
plus target-local P2 cleanup that removes stale surfaces or makes the new shape
canonical.

After implementation starts, do not add newly discovered P2/Parked items to the
active checklist unless they are inside the accepted target and directly support
the canonical new shape. Park cross-seam cleanup and unrelated taste changes.
After a gate is `DONE`, P2-only polish stays parked unless the user explicitly
reopens that exact slice.

## Confidence ladder

Use these levels when classifying a proposed change:

| Level | Name | Evidence |
| --- | --- | --- |
| L0 | Static | formatting, lint, whitespace, importable tooling |
| L1 | Unit/mock | fast unit and mock-backed behavior tests |
| L2 | Contract | frozen schemas, fixtures, CLI/report output contracts |
| L3 | Mock regression | baseline-vs-candidate behavior capture using mock providers |
| L4 | Local simulator | real simulator / rendering / physics validation |
| L5 | Local Gateway/provider | real OpenClaw/Gateway/VLM/API validation |
| L6 | Navigator harness | coding-agent-in-the-loop task run with curated metrics |

## Workflow

### 1. Orient and classify

Read the user's goal and identify:

- target area or module
- target seam, if known
- whether the request is bug/perf shaped, architecture shaped, cleanup shaped, or
  feature shaped
- user-visible behavior that must not regress
- what "done" would prove from a caller's perspective
- old APIs, paths, wrappers, or compatibility shims that should be removed
- minimum required confidence level
- whether the target repo's LSP is configured and healthy for the affected
  language stack
- whether any evidence is local-only, paid, slow, or environment-sensitive
- whether this is architecture/public-contract shaped and therefore needs an
  architecture packet before edits

If repo-local docs exist, read the agent config first:

- `docs/agents/domain.md`
- `docs/agents/issue-tracker.md`
- `docs/agents/triage-labels.md`

Then read the repo's required orientation docs before making claims.

Look for an existing gate before proposing new work:

- `docs/plans/*refactor*.md`
- `docs/plans/*architecture*.md`
- a user-provided plan path
- GSD phase artifacts if the refactor is already a committed phase

If the target seam is unclear, stop after a report-only map. Do not wander
through the whole repo looking for unrelated cleanup.

If the target is architecture/public-contract shaped, look for an existing
architecture packet in the user prompt, plan, ADR, or gate. If none exists, run
`$zoom-out` and `$plan-eng-review` before producing the scope gate. If that
review sequence still leaves no accepted target seam, use
`$improve-codebase-architecture` as extra report-only candidate discovery.

Check LSP before risky symbol-level edits. Use repo evidence such as manifests,
lockfiles, compiler config, `.claude/settings.json`, `.vscode/settings.json`,
`docs/agents/**`, and language-server config to determine whether definition,
reference, rename, diagnostics, and hover signals should work for the target
language. If LSP setup is missing or stale and the fix is repo-local, route the
setup through `$intuitive-init` or include the minimal setup change before
production refactor edits. If setup is unsafe, global-only, or unclear, record
it as missing evidence and either stop or proceed only at the lower confidence
level the user accepted.

### 2. Decide the evidence path

Default to the smallest evidence path that can make the gate honest: produce the
scope gate, write/update the persistent gate file when appropriate, and execute
the accepted cleanup when the user has approved the target.

Before choosing commands for a non-trivial refactor, inventory the repo's
available verification layers from local docs, scripts, package/Make targets,
CI, and existing test or harness guidance. Use the shared proof selector in
`../../_shared/references/durable-run.md` to pick the smallest sufficient proof by
change class. Do not run full-suite, visual, simulator, browser, hardware, or
manual gates after every slice unless that proof uniquely observes the behavior
the slice can regress.

Use another workflow when it materially improves the current pass:

- unclear architecture or seam quality -> run `$zoom-out` plus
  `$plan-eng-review`; use `$improve-codebase-architecture` only as extra
  report-only candidate discovery
- missing behavior coverage -> use TDD to add one public-interface proof
  before refactoring
- bug, flake, perf regression, or known blind spot -> diagnose to build
  a reproducible feedback loop first
- large feature or harness program -> create a PRD, then issues
- existing issue queue or TODO grooming -> triage
- layout-shaped cleanup -> keep it here only when the object is code, package,
  module, API, imports, wrappers, or compatibility surfaces; route docs layout
  to `$intuitive-doc`, test layout to `$intuitive-tests`, and mixed repo-surface
  diagnosis to `$intuitive-reduce-entropy`

Do not split into issues before the parent plan or PRD is shaped enough to split
into vertical slices. A capable agent may do the work inline when it can meet
the same evidence, scope, and stop-condition requirements without extra process.

### 3. Produce the scope gate

Before implementation, present this compact gate:

```markdown
## Refactor Scope Gate

- Target:
- Change type:
- Current status:
- Accepted severities:
- Accepted issue checklist:
- Parked issues:
- Compatibility kept:
- Compatibility removed:
- Minimum confidence level:
- Existing evidence:
- Missing evidence:
- Architecture packet:
- LSP status:
- Local-only gates:
- Recommended next skill:
- Persistent gate file:
- Stop condition:
```

The stop condition must be concrete enough that an agent can stop even if it can
still imagine more cleanup. Good stop conditions look like:

- "All accepted cleanup items pass `npm run test:publish-rules` and
  `npm run quality:check`; old APIs are removed. If the user requested a
  temporary migration bridge, it has a recorded removal trigger."
- "Stop after report-only architecture candidates; wait for the user to pick
  one candidate."
- "Stop before implementation because the next proof requires real Gateway
  access."

If implementation is approved, write or update the persistent gate file before
editing production code. If there are accepted cleanup items, mark it
`CONTINUE`. If the scan finds only cross-seam or speculative ideas, mark it
`PARK` and stop.

### 4. Execute one vertical slice

When the user approves action, work in one tracer bullet:

1. Add or identify the proof first.
2. Verify target-repo LSP setup for the affected language, or record why that
   evidence is unavailable.
3. Watch the proof fail if adding new coverage.
4. Apply the smallest coherent aggressive cleanup/refactor.
5. Run the required ladder levels.
6. Summarize evidence and residual risk.

Never batch unrelated refactors. If a proposed architecture cleanup touches
multiple seams, split it with `/to-issues` or park the extra seams.

### 5. Close the loop

Before declaring completion, audit the accepted checklist against real evidence:

- every accepted cleanup item has a concrete change or a documented "no change
  needed" reason
- every required evidence level has command output or a stated skipped gate
- target-repo LSP setup was checked, refreshed, or explicitly recorded as
  unavailable with its impact on confidence
- target-local P2 cleanup is either completed or explicitly deferred
- every cross-seam/Parked item is recorded and not silently implemented
- every old API/path/compatibility surface is removed, or any user-requested
  temporary bridge has a recorded removal trigger
- no unapproved new refactor work was added after implementation began

Update the gate file with the final checklist status, evidence commands, skipped
gates, and parked ideas. Also update both status markers:

- mark `DONE` when the accepted checklist is complete and evidence is green
- mark `CONTINUE` when accepted cleanup work remains
- mark `PARK` when only cross-seam or future ideas remain
- mark `REOPEN` only when the user explicitly widens scope or new P0/P1 evidence
  invalidates a previous `DONE`

## Suggested repo command naming

Prefer a `verify::*` namespace for deterministic safety gates:

- `verify::static`
- `verify::mock`
- `verify::contract`
- `verify::regression-mock`
- `verify::sim-local`
- `verify::openclaw-local`
- `verify::navigator`
- `verify::full-local`

Reserve `harness::*` for a specific agent/simulator harness, not generic lint
or unit-test commands.

If the repo has different commands, use the repo's existing names and map them
to ladder levels in the safety plan.

## Suggested prompt

Use this shape when the user wants a bounded architecture pass:

```text
Run $intuitive-refactor.

Scope: one named module/seam only.
Start with a scope gate. For a named target, execute the accepted cleanup.
Load any existing docs/plans/refactor-*.md or architecture plan first.
Classify findings as P0/P1/P2/Parked.
Implement accepted P0/P1/P2 cleanup inside the target.
Write/update one persistent gate file in docs/plans/.
Remove old APIs, wrappers, and compatibility shims unless explicitly protected.
Record cross-seam/Parked items there instead of implementing them.
Stop when the accepted cleanup checklist passes the required confidence ladder.
Commit each coherent slice only when the user and repo policy authorize
commits.
```

If the user combines this with an architecture scanner, add:

```text
Use `$improve-codebase-architecture` only for report-only candidate discovery.
The accepted checklist and stop condition still come from the refactor scope
gate.
```

## Output when only advising

If the user is still discussing strategy, do not edit files. Return:

- recommended command namespace
- proposed confidence ladder
- current/persistent status, if a gate file exists
- accepted severity threshold
- concrete stop condition
- whether a persistent gate file should be created or updated
- which optional skill, if any, should be used next
- which part should become a PRD or issue only if it is large enough

## Completion summary

After action, report:

- files changed, if any
- persistent gate file path and status
- accepted checklist status
- parked issues, if any
- ladder levels run and results
- gates skipped and why
- whether the change is safe for AFK agent pickup, human review, or local
  validation
