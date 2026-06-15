---
name: intuitive-flow
description: |
  Stable build/change entrypoint that routes by task scope: tiny concrete work
  can run directly, refactor-shaped work delegates to intuitive-refactor, and
  broad or durable work runs through staged planning, review, GSD handoff,
  implementation, cleanup, and verification. Use when the user asks for fuzzy
  idea shaping, durable planning, implementation from a plan, Matt Pocock skills
  + gstack + GSD together, broad refactor routing, or one coherent source of
  truth from idea to verified work.
---

# Intuitive Flow

`$intuitive-flow` is a stable user-facing trigger, not only the heavy workflow.
Accept the trigger, then route work through the smallest executor that preserves
a clear source of truth. This skill is an orchestrator: use downstream skills
for their own mechanics, and keep canonical route decisions in the main session.

## Latest User Intent Gate

Before Hot Resume, Read First, route discovery, worker relaunch, or any edit,
treat the latest user message as authoritative.

If the latest message asks to stop, pause, avoid changes, discuss first, inspect
status only, or challenges why implementation is happening, enter read-only
control mode. Do not resume the previous goal, launch workers, run tests, edit
files, or create commits. Allowed actions are limited to reporting current
goal/worktree state, reading small status artifacts, and proposing the next
decision. Resume execution only after a later user message explicitly asks to
implement, run, continue, or resume.

This gate overrides durable-run auto-continue, Hot Resume, GSD execution,
worker babysitting, and inherited handoff instructions.

## Host Goal Gate

When the host exposes persistent goal state, check it before treating an active
run as resumable. A host-level goal that is `blocked` or `complete` is a stop
gate, not a cue to continue. If the latest user message asks to stop or pause,
close or block the goal when host policy allows, then treat the run as stopped.

An active host goal is evidence of prior intent, not authorization to override
the latest user message. Restart a stopped goal only after the user explicitly
requests a fresh resume and the route brief names the new stop gate.

## Goal Ownership Model

Use two goal layers for durable Flow runs:

- Main-session root goal: owns the Flow contract, route decisions, canonical
  source of truth, stop gate, babysitting, and final complete/blocked decision.
- Worker-local sub-goal: owns exactly one tmux/`skill-runner` sub-phase with a
  bounded artifact, proof command, and handoff.

If Flow is invoked while a main-session root goal is already active, adopt that
goal as the parent/root goal. Do not create, restart, clear, or replace it from
Flow. If no root goal exists and the user explicitly requested durable
execution, Flow may create one after the run contract is clear.

Worker goals are child scopes, not independent project goals. A worker may use a
host-local `/goal` only for its assigned sub-phase. It must stop with a compact
handoff, close or block its worker-local goal when host policy allows, and leave
the main-session root goal untouched. The main session then decides whether the
root goal continues, changes route, completes, or blocks.

## Hot Resume Gate

After the latest user intent and host goal gates, check whether this is an
active-goal resume/debug turn. Hot Resume applies when an active durable run or
goal already exists, a canonical plan/status source already exists, the user
asks to continue, resume, inspect status, debug a repeated blocker, or prevent
looping, and no new product/scope decision is requested.

When Hot Resume applies, do not run normal route discovery first. Read only:

1. the task capsule, if one exists;
2. `git status --short`;
3. `git log -3 --oneline`;
4. at most one focused machine-readable artifact summary.

Then emit a Hot Resume experiment contract before implementation. If no capsule
exists and the run is not trivial, create or request one as the first action
instead of expanding into the full workflow. Normal route discovery is an
escalation for ambiguous routes, missing canonical state, new planning/review
requests, or a contract that explains why low-context resume is insufficient.

## Self-Modification Gate

When changing `intuitive-flow` itself, default to a read-only self-audit before
patching: inspect the existing guard, identify the smallest missing behavior,
and state the intended delta. Do not edit the skill merely because an older
durable goal is active. A direct user request such as "do it", "apply this
delta", or "change the skill" is enough permission to patch the named files;
otherwise stop after the audit and ask for confirmation.

## Read First

Load only the reference needed for the selected route:

| Need | Read |
| --- | --- |
| Active-goal resume/debug, context budget, loop breaker, experiment contract | `references/context-budget-and-loop-guard.md` |
| Source-of-truth, `STATUS.md`, `CONTEXT.md`, provenance, phase granularity | `references/source-of-truth.md` |
| Fuzzy idea shaping, single plan-file intake, unknown-unknown scout/reconciliation | `references/plan-intake-and-autoplan.md` |
| GSD ingest vs plan-phase routing, committed phase execution, `simplify` scope | `references/gsd-handoff.md` |
| Whole-run preflight, goal ownership, soft continuation vs hard stop, checkpoint policy, tmux/goal/clear policy | `references/checkpoints-and-auto-run.md` |
| Broad refactor route, semantic commits, final `$intuitive-doc` doc-alignment sub-phase, parked-todo closeout | `references/refactor-and-closeout.md` |
| Exact response and artifact templates | `references/output-shapes.md` and `templates/` |

If a route crosses multiple concerns, read the relevant references just before
the boundary. Do not preload every reference by default.

## Core Invariants

- The latest user message has priority over any prior goal, capsule, worker
  handoff, plan, or auto-run instruction. Stop/discuss/status-only language
  means read-only control mode until the user explicitly resumes execution.
- Host-level goal state is a hard gate. `blocked` and `complete` goals do not
  auto-resume; a new resume needs explicit user intent and a fresh route brief.
- Flow owns at most one main-session root goal. Adopt an existing active root
  goal; create a new one only for explicit durable execution with a clear run
  contract; never let worker-local goals mutate or clear the root goal.
- Worker-local goals must be scoped to one tmux/`skill-runner` sub-phase and
  end with handoff plus complete/blocked status before control returns to the
  main session.
- When editing this skill, use the self-modification gate: audit first, patch
  only the named smallest delta after current-turn user permission.
- For active-goal resume/debug turns, Hot Resume is the default route. Normal
  route discovery is an escalation, not the default.
- For Hot Resume, default to a low context budget: no large files, full plans,
  full status docs, full logs, full JSON, or additional skill references unless
  the experiment contract states why low budget cannot decide the next action.
- If the current stop gate proves the next required evidence is blocked on a
  human action, local hardware, paid account, external service, or another
  outside actor, stop the Flow before route discovery, parked-todo triage,
  cleanup, or alternate-slice selection. Report the exact gate result and, when
  host policy allows, mark the root goal `blocked`. Do not keep progress alive
  with convenience patches, observability-only edits, or "one more small"
  adjacent task.
- A change is not aligned progress if it only records more details about the
  same blocker without changing the next decision. Observability edits require
  an explicit expected decision delta.
- If the same blocker kind appears in two consecutive resume/debug turns
  without a changed root-cause classification, the next turn must run a
  root-cause comparison experiment, mark/defer the capability in canonical
  state and continue a different requirement, or ask the user for a hard
  decision. Do not keep making low-information tweaks.
- Keep one source of truth per stage: `docs/plans/*.md` or GitHub issues before
  committed execution, `.planning/STATE.md` and `.planning/phases/*` during GSD,
  and verification/summary artifacts after shipping.
- Use a single `docs/plans/<slug>.md` as the canonical pre-GSD plan. Treat a
  single plan-like file under `docs/adr/`, `docs/adrs/`, or `docs/human/` as
  source evidence to refactor into `docs/plans/`, not as the review ledger.
- Do not implement a plan-backed request until the canonical plan records an
  approved `$intuitive-preflight` contract and either an explicit
  unknown-unknown scout result or a skip reason. `gstack-autoplan` is one
  planning-stage scout option; it is not a hidden execution gate after
  grill-batch and preflight approval. Tiny direct edits that are not using a
  plan as source of truth may bypass this.
- Do not create competing `.planning/phases/*` artifacts while the team is still
  brainstorming in `docs/plans/*.md`.
- For plan-backed implementation, treat the canonical plan and relevant context
  files as the context package. Read the `docs/plans/<slug>.md` source plus
  any `CONTEXT.md` / `CONTEXT-MAP.md` files it references before editing code.
  If `CONTEXT-MAP.md` exists, use it to select the relevant context instead of
  assuming only root `CONTEXT.md`. Context files are evidence for domain terms,
  durable boundaries, and acceptance criteria; they are not PRDs or execution
  ledgers.
- Ask only for hard-stop decisions. Auto-continue routine, reversible, or
  already-implied choices during a confirmed durable run.
- Keep the main session as the control plane for durable multi-stage runs.
  Route stateful execution through `skill-runner`/tmux workers by default so
  host-local `/goal`, `/compact`, `/clear`, or equivalent context controls stay
  isolated from route decisions and supervision history.
- Durable implementation in the main session is an exception. Use it only when
  the route brief explicitly explains why the work is tiny, bounded, and safe
  for main-session context; otherwise launch a bounded `skill-runner`/tmux
  worker and babysit from the main session.
- On Codex, follow `$skill-runner`'s Codex delegation policy: avoid native
  subagents by default, keep tiny work in the main session, use Paseo subagents
  for parallel read-heavy scouts or short bounded independent tasks when the
  host-provided Paseo subagent tool is available and probed, and use
  `skill-runner`/tmux workers for isolated
  durable sub-phases.
- For durable runs that change local code, create semantic commits along the
  way after each coherent proof-backed slice. Do not wait until the entire flow
  is done unless commits are explicitly disabled or staging cannot be made safe.
- Before any closeout that changed files, run a commit audit: inspect
  `git status --short`, separate owned changes from unrelated dirty files,
  commit the owned verified slice, and leave unrelated files exactly as they
  are. A dirty worktree is not by itself a reason to skip commits.
- Verify before completion. For implementation/refactor work, report tests or
  verification run, final `$intuitive-doc` doc-alignment result for significant
  changes/refactors, and parked todos even when none were found.
- Before closing a significant implementation or big refactor, run one explicit
  final `$intuitive-doc` sub-phase after code/simplify/verification and before
  parked-todo closeout. It must check `README.md`, `ARCHITECTURE.md`,
  `STATUS.md`, and `docs/human/**`, update drifted human truth, and move or
  remove obsolete legacy docs when they are no longer needed, especially stale
  files under `docs/human/`.
- Before closing plan-backed implementation, audit the source
  `docs/plans/<slug>.md` for stale status. If the run implemented all or part of
  that plan, update the plan in the same closeout slice: refresh `Status`,
  `Last reviewed`, current implementation contract, shipped evidence, and
  remaining parked/follow-up slices. A plan that still reads as "Proposed",
  "to implement", or "next slice" after the flow already shipped the work is
  drift and will mislead the next agent. Mark it `Implemented`,
  `Partially implemented`, `Superseded`, or keep it `Active` with explicit
  remaining gates; do not mark it implemented when unverified acceptance gates
  or parked in-scope work remain.
- Before marking a durable implementation/refactor complete, run parked-todo
  triage. If a parked item is still inside the original objective and is either
  required for completion or a bounded high-value follow-up with an explicit
  verification gate, continue one additional parked-follow-up slice instead of
  closing. Run at most one automatic parked-follow-up slice per flow closeout;
  after that, report remaining parked work and wait for explicit user direction.
- For durable auto-runs, make stop conditions executable whenever possible.
  Prefer a repo-local gate such as `npm run goal:status`,
  `npm run validate:<gate>`, or a documented phase verifier that returns a
  machine-readable `complete`, `blocked`, or `failed` result. If such a gate says
  the next required evidence is owned by the human or another external actor,
  stop the flow instead of looking for adjacent cleanup work. This rule outranks
  parked-todo follow-up and broad "continue one by one" instructions unless the
  user explicitly names a different requirement to pursue while the external
  blocker remains.
- If Serena project memories are configured, treat them as an optional
  acceleration layer after canonical docs are correct. Check/update only durable
  memory facts that changed during the flow; never use memories as canonical
  status, active plan, or secret storage.

## Route Brief

Before non-trivial artifacts or edits, show a compact route brief. For tiny
direct work, one sentence is enough.

```text
Current state: <fuzzy idea | draft plan | reviewed plan | GSD phase | changed code | refactor goal | direct implementation>
Latest user intent: <execute | read-only/status | discuss-first | stop/pause>
Host goal state: <none | active | blocked | complete | unavailable>
Goal ownership: <adopt existing root | create root | no root goal | worker sub-goal only>
Selected path: <stage or skill sequence>
Why: <one sentence>
Bypassed/left behind: <stage - reason; stage - reason>
Execution surface: <read-only main session | main session direct with exception reason | Paseo subagent | skill-runner/tmux worker per sub-phase>
Babysitter cadence: <none | every N min based on task risk/proof duration>
Commit rhythm: <semantic commits enabled | disabled because ...>
Stop gate: <repo command/artifact that decides complete | blocked | continue, or "none">
Stop/continue point: <where work pauses or what will run now>
```

Name plausible but skipped stages such as `$agent-planning-loop`,
`grill-with-docs`, unknown-unknown scouting with `gstack-autoplan`, `to-issues`,
GSD handoff, `simplify`, or verification. This makes shortcuts visible without
turning every task into a ceremony.

## Stable Entry Router

When invoked, accept `$intuitive-flow` as the entrypoint and classify the task
before choosing the execution surface:

- Read-only diagnostics, status checks, and one-file/two-file concrete fixes:
  use the direct route in the main session with a short route note and focused
  evidence.
- Refactor, cleanup, stale API, compatibility, module layout, or known seam
  work: route to `$intuitive-refactor` so the scope gate, accepted checklist,
  evidence ladder, and stop condition are explicit.
- Plan-backed, broad, stateful, multi-stage, or long-running work: use durable
  Flow and `skill-runner`/tmux as needed.

Do not make the user choose the specialist skill upfront when `$intuitive-flow`
can classify the request safely. The route brief should name the selected path,
the executor, and any heavier stages bypassed.

Before executing a vague task, plan-backed task, or short approval prompt such
as "LGTM, do this", route to `$intuitive-preflight` when the current plan or
conversation does not already contain an approved preflight contract with
context package, scope, non-goals, definition of done, verification, route,
worker strategy, and main-session `/goal` wording. Do not start durable
implementation from a thin approval prompt and invent success criteria during
execution.

## Stage Router

Start by classifying the user's current state. Then read the matching reference
and run the shortest safe route.

| Current state | Default route | Reference |
| --- | --- | --- |
| Fuzzy idea | route upstream to plan entropy mode, direct shaping, or `$agent-planning-loop`; Flow execution waits for an approved plan/preflight unless the task is tiny and direct | `plan-intake-and-autoplan.md` |
| Draft plan exists | single plan-file intake if needed -> optional explicit `gstack-autoplan` unknown-unknown scout for non-trivial plan-backed work -> reconcile accepted findings into the plan | `plan-intake-and-autoplan.md` |
| Reviewed plan, not under GSD | confirm approved preflight plus scout result/skip reason in the canonical plan -> optional `to-issues` -> `gsd-plan-phase --prd` or manifest + `gsd-ingest-docs` then `gsd-plan-phase` | `gsd-handoff.md` |
| Committed GSD phase | `gsd-execute-phase <phase>` -> `simplify <changed-scope>` -> `gsd-verify-work <phase>` -> final `$intuitive-doc` doc-alignment sub-phase when significant human truth may have changed | `gsd-handoff.md` |
| Architecture/refactor goal | route to `$intuitive-refactor` for scope gate -> execute accepted P0/P1 slices -> final `$intuitive-doc` doc-alignment sub-phase -> parked-todo closeout | `refactor-and-closeout.md` |
| Changed code cleanup | `simplify <changed-scope>` -> rerun relevant proof | `gsd-handoff.md` |
| Direct concrete edit | implement locally -> focused verification -> closeout; bypass planning stages with reason | `output-shapes.md` as needed |

Treat direct routing as an internal `$intuitive-flow` decision, not a refusal of
the trigger. If the task is small and concrete, run it directly and say which
heavier stages were bypassed. If the task is cleanup/refactor-shaped, delegate
to `$intuitive-refactor` instead of silently broadening direct implementation.
Escalate to durable Flow only when the task needs staged source-of-truth
management, review/handoff, broad refactor control, or long-running isolated
execution.

For whole-flow or durable auto-runs, first read
`references/checkpoints-and-auto-run.md` and confirm the run contract unless the
latest user message already supplied goal, success criteria, stop condition, and
boundaries and told you to use them as-is.

If `$intuitive-preflight` produced the approved preflight contract, treat that
contract as the execution source. Preserve the main session as the root
supervisor; use worker-local goals only for bounded `skill-runner` sub-phases.

When resuming a durable auto-run, check the stop gate before doing new work. If
canonical state already says the current phase is blocked and the gate still
reports the same external-input blocker, do not create extra scaffolding just to
make progress; close the goal as blocked when the host goal rules allow it, or
stop with the exact gate result.

If the current gate newly reports a required external-input blocker, treat that
as an immediate stop as well. Do not first search parked todos, cleanup tasks,
or a smaller adjacent implementation slice. Continue only after the user either
removes the external blocker or explicitly chooses a separate requirement whose
completion does not pretend to satisfy the blocked gate.

## Delegation

Keep the main session responsible for route decisions, canonical artifact edits,
integration, and final synthesis.

For durable multi-stage runs, default to a control-plane split. The main session
does not directly execute durable implementation unless the route brief records
an explicit exception for tiny, bounded work that will not threaten route
continuity.

- Main session: route, decide, inspect worker artifacts/diffs/logs, verify
  claims, own the root goal, and synthesize the next stage.
- Worker tmux session: execute one bounded sub-phase with its own stop
  condition, optional worker-local `/goal`, and disposable context.
- Babysitter steering: choose a review cadence per worker from expected proof
  duration, risk, and artifact rhythm. Let healthy long-running refactors
  continue, but stop or steer a worker that has no durable progress, loops,
  broadens scope, or pursues the wrong artifact. Inspect captured
  logs/diff/artifacts before relaunching with a corrected goal or stopping for a
  hard decision.

Tiny direct edits and read-only probes may stay in the main session only when
the latest user intent permits execution and the route brief names the
main-session exception. Do not use `/goal clear` or `/clear` in the main session
while an active flow depends on conversation context. If context pressure
appears in the main session, prefer a handoff-style `/compact` and keep
canonical artifacts current.

Delegation policy lives in `$skill-runner`'s Codex delegation reference. This
skill chooses whether work stays in the main session, moves to a Paseo
subagent, or moves to a `skill-runner`/tmux worker.

| Work type | Preferred executor |
| --- | --- |
| Independent read-heavy probes | main session or Paseo subagent when parallelism/isolation is worth it |
| Verification-heavy log/test inspection | main session, Paseo subagent, or `skill-runner`/tmux when artifacts matter |
| Bounded disjoint edits | `skill-runner`/tmux workers when main-session context would suffer; Paseo only for short bounded tasks with clear ownership |
| Stateful, interactive, durable, or long-running skill pipelines | `skill-runner` / tmux worker per sub-phase |
| Canonical source-of-truth edits and route decisions | main session |

For Paseo subagents, require a structured final summary and inspect the
host-provided Paseo subagent activity/status surface before trusting the result.
Do not invoke `paseo run` or `paseo agent run` from skills because those create
separate user-visible sessions/tabs.

For `skill-runner`, inspect compact artifacts such as `result.md`, `eval.md`,
`last-message.md`, targeted logs, the actual diff, and verification evidence
before trusting final status.

When a worker uses `/goal`, clear, close, or block only that worker-local goal
inside the worker after the sub-phase leaves durable state. Prefer exiting the
worker over clearing and continuing in the same terminal. The main session then
reads the handoff and decides the next worker scope. Workers must not clear,
restart, or complete the main-session root goal.

Worker handoff shape:

```text
Scope:
Parent/root goal:
Worker sub-goal:
Changed files:
Decisions made:
Verification:
Open risks:
Suggested next action:
```

## Hard Stops

Stop and ask the user when a choice would materially change:

- target user, demand premise, narrowest wedge, or product direction
- scope boundary, public contract, data model, phase split, or roadmap ownership
- security, privacy, paid infrastructure, external-service dependency, or API key use
- destructive action, broad file moves/deletions, or proof requiring unavailable
  local hardware/services such as Docker, GPU, real Gateway, real simulator, or API keys
- conflicting locked docs/ADRs or multiple plausible GSD phase matches

During a confirmed durable run, auto-answer soft continuations that preserve the
accepted plan, restate known premises, follow repo conventions, run normal
review/test/verification steps, or choose a reversible low-risk default.

## Commit Rhythm

Semantic commits are enabled by default when a durable implementation or
refactor run changes local code and repo/user instructions do not disable
commits. Commit as the flow progresses after each coherent proof-backed code
slice, then continue from that clean boundary instead of accumulating a large
end-of-run diff. For docs-only changes that are part of durable plan
reconciliation, implementation evidence, status, or closeout, use the same
commit default. Leave commits disabled only for review-only, question-answering,
or explicitly plan-only work unless the user asked for a docs commit.

Default to at least one semantic commit before final closeout whenever owned
files changed. Use several commits when the diff has multiple independently
reviewable intents; use one commit when the changed set is small and coherent.
Do not finish a durable flow with verified owned changes merely staged or
unstaged.

Treat inherited handoff notes such as "commits disabled" or "do not commit" as
claims to verify, not as binding instructions, unless they clearly quote the
current user, repo guidance, or a hard technical blocker. On resume, check the
current user request, repo instructions, and `git status`. If commits are still
safe, restore the default semantic-commit rhythm. Treat inherited dirty changes
that are inside the accepted scope as owned once you have inspected and verified
them; inherited authorship alone is not a blocker. If commits are not safe,
name the exact blocker and keep it narrow, such as "unrelated dirty changes
overlap the same hunks and cannot be staged safely."

Commit only owned files. Before each commit, inspect `git status` and the staged
diff, run or record the relevant proof, and use a semantic message such as
`feat(<area>): ...`, `fix(<area>): ...`, `refactor(<area>): ...`, or
`test(<area>): ...`. Use path-specific staging for owned files or hunks and
leave unrelated user changes, generated artifacts, worktrees, caches, model
weights, and local outputs unstaged. Unrelated dirty files outside the owned
slice should be mentioned as left alone, not used to disable committing the
owned slice. If unresolved blockers, user instructions, or overlapping
unrelated hunks make a slice commit unsafe, leave only that slice uncommitted
and record the reason in the route brief or closeout.

Before final answer on a durable implementation/refactor run, require one of
these states:

- owned changes committed, with commit ids ready for closeout;
- no files changed;
- commit explicitly disabled by current user/repo/phase rule;
- precise unsafe-staging blocker recorded, with unrelated changes left as-is.

Read `references/refactor-and-closeout.md` before creating commits during this
workflow.

## Closeout

Use `references/output-shapes.md` for exact shapes. Implementation/refactor
closeout must include:

- what changed
- verification run and result, or what was not run
- proof card with claim level, required gates run, required gates
  skipped/blocked, and evidence artifacts
- final `$intuitive-doc` sub-phase result for significant implementation/refactor
  work, including doc updates, moves, removals, or checked-and-left-unchanged
- semantic commit ids created, or why commits were disabled
- scope changes, always, including `none`; include accepted scope changes from
  unknown-unknown scout, plan reconciliation, GSD handoff, refactor gates, or
  execution discoveries
- source plan freshness result for plan-backed implementation: updated
  `<docs/plans/...>`, checked and left unchanged with reason, or not applicable
- `STATUS.md` check/update result for non-trivial durable runs
- Serena memory check/update result when Serena memories are configured, or
  `not configured/not available`
- parked todo triage result, including whether an automatic follow-up slice was
  run or skipped
- parked todos, always, including `none found`

At the very end of any completed Flow implementation/refactor, explicitly list
`What changed`, `Proof`, `Scope changes`, and `Parked todos` as visible headings
or clearly labeled bullets in the final user-facing response. Do not rely on a
brief prose summary, commit message, worker handoff, or verification log to
imply them. If any category is empty, still print the category with `none`. If a
required product-run, local/live, or manual gate was skipped or blocked, the
proof claim level must be `partial` or `blocked`, not full completion.

## Anti-Patterns

- Do not run every downstream skill just because it exists.
- Do not silently bypass plausible idea shaping, unknown-unknown scouting,
  GSD handoff, cleanup, or verification; say what was skipped and why.
- Do not use `gstack-autoplan` as implementation or refactor execution.
- Do not treat `gsd-ingest-docs` and `gsd-plan-phase` as interchangeable.
- Do not pass one markdown file as a `gsd-ingest-docs` scan path; use a manifest.
- Do not manually copy a plan into phase `CONTEXT.md`; use
  `gsd-plan-phase <phase> --prd docs/plans/<slug>.md`.
- Do not create an ADR for routine implementation progress.
- Do not use `simplify` as a broad architecture scanner.
- Do not close significant implementation/refactor work without verification,
  final `$intuitive-doc` doc alignment, and parked-todo visibility.
- Do not finish a completed Flow with only a narrative summary; final responses
  must explicitly enumerate what changed, scope changes, and parked todos.
