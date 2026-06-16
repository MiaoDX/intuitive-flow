# Refactor Workflow Stage Boundaries

Status: Implemented
Created: 2026-06-12
Last reviewed: 2026-06-12
Archived note: historical provenance only; active workflow truth now lives in
README.md, ARCHITECTURE.md, STATUS.md, docs/human/**, and skills/**.
Current implementation contract: Implemented in this checkout. Human docs,
skill contracts, the default allowlist, and rename-sensitive tests now make the
staged workflow explicit:
`repo/plan entropy -> optional gstack-autoplan unknown-unknown scout ->
grill-batch -> preflight -> intuitive-flow execution`.

Shipped evidence:

- `README.md`, `ARCHITECTURE.md`, `STATUS.md`, and `docs/human/**` describe the
  staged workflow and public skill roles.
- `skills/intuitive-reduce-entropy/SKILL.md` requires explicit repo entropy mode
  or plan entropy mode before auditing.
- `skills/intuitive-flow/SKILL.md` and Flow references route vague prompts
  upstream, treat approved preflight as the execution boundary, and route
  `gstack-autoplan` to planning-stage unknown-unknown scouting instead of a
  hidden execution gate.
- `skills/agent-planning-loop/SKILL.md` is the canonical scout-planning root
  skill; `scripts/default-skill-allowlist.txt` lists
  `intuitive-planning-loop` as `legacy-skill` for updater-owned cleanup.
- Verification passed on 2026-06-12: targeted grep checks, targeted allowlist
  and sync tests, `bun run check:skills`, `bun run check:shell`,
  `bun run check`, and `bun run verify`.

Remaining work: none inside this plan's accepted scope. Optional live
`./scripts/update.sh` validation is still maintainer-owned because it mutates
user-level tool installs.

## Goal

Make the recommended planning-to-execution workflow explicit across the human
docs and skill contracts:

```text
reduce-entropy / agent planning -> grill-batch -> preflight -> intuitive-flow execution
```

`$intuitive-flow` should remain a stable user-facing trigger and compatibility
router, but the recommended path should treat it as the execution orchestrator
after an approved plan or preflight contract exists.

## Idea Shaping Mode

direct discussion

## Original Source Evidence

This section records the drift observed before implementation. It is historical
evidence for why the refactor happened, not a current-state checklist.

- User discussion on 2026-06-12 - approved the staged A/B/C/D workflow and the
  principle that explicit mode selection is better than implicit routing.
- `README.md` - originally presented `$intuitive-flow` as the default
  shaping/build/change entrypoint.
- `ARCHITECTURE.md` and `STATUS.md` - originally listed the old primary skill
  surface and active focus.
- `skills/intuitive-flow/references/plan-intake-and-autoplan.md` - originally
  allowed inline `intuitive-flow` idea shaping as a default path.
- `skills/intuitive-reduce-entropy/SKILL.md` - originally described repo
  maintenance only, while actual usage also included plan/idea entropy review.
- historical `skills/intuitive-planning-loop/SKILL.md` - behavior was
  agent-scout planning, but the public name did not expose that distinction.
- `scripts/default-skill-allowlist.txt` and
  `scripts/lib/default-skill-allowlist*.ts` - renaming a root skill changes the
  installed skill surface and must be handled through root-skill plus
  legacy-skill ownership cleanup.
- `skills/intuitive-flow/references/plan-intake-and-autoplan.md` - originally
  treated `gstack-autoplan` evidence as a hard precheck before plan-backed
  implementation, which conflicts with using grill-batch plus preflight as the
  explicit approval boundary.

## Decisions Already Made

- The recommended workflow is staged: reduce/agent planning first, grill-batch
  for unresolved decision quality, preflight for execution contract, and
  intuitive-flow for implementation orchestration.
- `$intuitive-flow` keeps forward compatibility as a router, but should not be
  documented as the preferred way to take a vague idea directly through every
  stage.
- `$intuitive-preflight` is the hard boundary between planning and execution.
- `intuitive-reduce-entropy` should make its mode explicit before work starts:
  repo entropy mode for repository cleanup, plan entropy mode for idea/plan
  review.
- `intuitive-planning-loop` should be renamed or presented as an
  agent-planning loop so users understand that agent scouts do the planning
  debate before human review.
- The target shape is forward migration, not permanent aliasing: install and
  document `agent-planning-loop`, migrate in-repo references, and list
  `intuitive-planning-loop` as a legacy skill for updater cleanup unless a
  concrete compatibility blocker is found during execution.
- Do not keep an installed `intuitive-planning-loop` alias after the rename.
  Natural-language mentions of "planning loop" may still route to
  `agent-planning-loop`, but the installed root skill surface should have one
  canonical name.
- The reduce-entropy entrypoint should explicitly choose a mode before
  auditing. Default to plan entropy mode when the prompt points at an idea,
  draft plan, or named plan file; default to repo entropy mode when the prompt
  asks for repo cleanup, maintenance, stale surfaces, source-of-truth drift, or
  "make this repo easier to work in."
- `gstack-autoplan` should no longer be a required hard precheck when a plan has
  passed grill-batch and has an approved `$intuitive-preflight` contract. It may
  remain an optional external review path, but its accepted decisions must be
  reconciled into the canonical plan before execution just like any other
  review evidence.
- `gstack-autoplan` should move into the planning stage as an unknown-unknown
  scout for non-trivial plan-backed work. It may find risks, missing tests,
  hidden scope changes, DX concerns, execution concerns, or hard-stop
  decisions, but it does not approve work and does not mutate the canonical
  plan by itself.
- For plan-backed execution, the approved `$intuitive-preflight` contract must
  be reconciled into `docs/plans/<slug>.md` before `/goal execute ... with
  intuitive-flow`, unless the task is a tiny direct edit that intentionally
  bypasses plan/preflight.
- This workflow refactor does not need a separate ADR by default. Use this plan
  and `ARCHITECTURE.md`; create an ADR only if implementation uncovers a
  durable trade-off future agents would otherwise relitigate.

## Idea Shaping Decisions

| # | Question | Classification | Decision | Rationale | Revisit if |
|---|----------|----------------|----------|-----------|------------|
| 1 | Should `$intuitive-flow` remain the broad forward entrypoint? | User-owned workflow boundary | Keep it as a compatibility router, but recommend the staged workflow. | This preserves ease of use without hiding planning/execution responsibility. | Users repeatedly expect Flow to do planning and execution without a preflight boundary. |
| 2 | Should reduce-entropy split into separate skills? | Naming and routing | Keep one skill for now, with explicit repo vs plan modes. | The entropy metaphor still works; explicit mode selection removes ambiguity. | The two modes grow different enough that shared instructions become confusing. |
| 3 | Should planning-loop be renamed? | Public skill surface | Rename to `agent-planning-loop`; treat `intuitive-planning-loop` as a legacy install name, not a permanent alias. | The important distinction is agent-side scouts and synthesis before human review, and forward migration matches repo guidance. | A concrete external-compatibility blocker appears that cannot be handled by legacy cleanup. |
| 4 | Should reduce-entropy choose mode silently? | Routing clarity | No. It must state the selected mode and why before auditing. | This applies "explicit is better than implicit" to the highest-ambiguity entrypoint. | Mode selection becomes obvious enough to encode as separate skills. |
| 5 | Does `autoplan` stay default before implementation? | Execution gate | Use `gstack-autoplan` as a planning-stage unknown-unknown scout for non-trivial plan-backed work, not as a Flow execution gate. | This keeps the blind-spot finder while preserving preflight as the execution contract boundary. | The scout produces too much noise or duplicates grill-batch without finding distinct unknowns. |

## Non-Goals

- Do not implement the refactor in this planning slice.
- Do not redesign GSD, skill-runner, or Multica goal tracking.
- Do not broaden this into a repo-wide skill cleanup beyond the workflow-stage
  boundary and naming changes.
- Do not remove `$intuitive-flow` as a public entrypoint.
- Do not preserve `intuitive-planning-loop` as a long-lived duplicate public
  skill unless execution finds a concrete compatibility blocker.
- Do not create a separate ADR unless the implementation discovers a durable
  trade-off not already resolved by this plan and `ARCHITECTURE.md`.

## Smallest Demo

Human docs and skill entry text consistently explain the staged workflow, and
`$intuitive-reduce-entropy` declares either repo entropy mode or plan entropy
mode before it audits.

## Fuller Demo

The public skill surface uses `agent-planning-loop` as the scout-based planning
name, marks `intuitive-planning-loop` as a legacy install for cleanup, and
updates docs, allowlist, skill references, and tests so future users see one
clear path from idea to execution.

## Target Workflow Contract

Use this as the implementation source of truth:

```text
Idea or draft plan:
  $intuitive-reduce-entropy in plan entropy mode
  -> gstack-autoplan unknown-unknown scout for non-trivial plan-backed work
  -> $grill-with-docs-batch until remaining items are implementation defaults
  -> $intuitive-preflight for scope, acceptance, verification, and stop gates
  -> /goal execute <plan-or-contract> with intuitive-flow

Repo cleanup or unclear maintenance target:
  $intuitive-reduce-entropy in repo entropy mode
  -> user selects candidates
  -> optional $grill-with-docs-batch or $intuitive-preflight
  -> specialist execution route or /goal execute ... with intuitive-flow
```

`$intuitive-flow` may still accept vague prompts as a compatibility router. In
that case it should select and name the upstream stage instead of doing hidden
idea shaping:

```text
Selected upstream stage: <plan entropy | agent planning | grill-batch | preflight>
Why: <one sentence>
Flow execution will wait until <approved plan | approved preflight | direct tiny task>.
```

Autoplan compatibility:

- An approved `$intuitive-preflight` contract after grill-batch is sufficient
  plan-backed execution evidence.
- `gstack-autoplan` belongs before grill-batch/preflight as an unknown-unknown
  scout for non-trivial plan-backed work.
- Tiny direct tasks and explicitly trivial plan edits skip the scout.
- Any accepted autoplan decisions remain evidence only until reconciled into
  `docs/plans/<slug>.md`.
- Raw `~/.gstack` artifacts are not canonical plan state.
- If autoplan runs, the planning-stage report must state what it changed, what
  it challenged, what needs grill decision, what was parked, and whether the
  canonical plan was updated.
- Flow execution should only check that the canonical plan/preflight records an
  unknown-unknown scout result or an explicit skip reason. It should not run
  autoplan as a hidden execution gate.

Unknown-unknown scout report shape:

```text
Unknown-unknown scout: <run | skipped>
Reason: <why it ran/skipped>
Findings:
- accepted into plan: <items or none>
- requires grill decision: <items or none>
- parked: <items or none>
- no material findings: <yes/no>
Canonical plan updated: <yes/no>
```

## Acceptance Criteria

- `README.md`, `ARCHITECTURE.md`, `STATUS.md`, and relevant `docs/human/**`
  describe the staged workflow as the recommended path.
- `$intuitive-flow` skill text and plan-intake reference present Flow as an
  execution orchestrator/router after plan/preflight approval, with explicit
  notes for compatibility routing from vague prompts.
- `$intuitive-reduce-entropy` documents and uses explicit `repo entropy mode`
  and `plan entropy mode` selection.
- The agent planning skill is renamed to `agent-planning-loop`, including the
  frontmatter `name`, directory path, default allowlist entry, docs, references,
  and command examples.
- `scripts/default-skill-allowlist.txt` lists `agent-planning-loop` as
  `root-skill` and `intuitive-planning-loop` as `legacy-skill` so updater-owned
  stale installs are removed on later syncs.
- `$intuitive-preflight` remains documented as the boundary that turns an
  accepted plan into an execution contract.
- For plan-backed work, approved preflight content is reconciled into the
  canonical plan before the execution goal starts.
- `skills/intuitive-flow/references/plan-intake-and-autoplan.md`,
  `skills/intuitive-flow/SKILL.md`, and GSD handoff references no longer require
  `autoplan` as a hidden hard precheck after an approved grill-batch/preflight
  path; they route any needed unknown-unknown scouting back to the planning
  stage.
- The planning-stage docs define the non-silent autoplan report shape and how
  grill-batch consumes material findings.
- Stale references to the old preferred workflow are updated or intentionally
  preserved with a compatibility explanation.
- Targeted tests cover the root-skill rename path: allowlist parsing, root skill
  drift detection, owned-root-skill pruning, and local sync behavior continue to
  pass after the rename.

## Verification

- `rg -n -F -e 'intuitive-planning-loop' -e 'planning-loop' -e 'default shaping/build/change' README.md ARCHITECTURE.md STATUS.md docs/human skills scripts/default-skill-allowlist.txt`
- `rg -n -F -e 'agent-planning-loop' README.md ARCHITECTURE.md STATUS.md docs/human skills scripts/default-skill-allowlist.txt`
- `rg -n -F -e 'repo entropy mode' -e 'plan entropy mode' skills/intuitive-reduce-entropy docs README.md ARCHITECTURE.md STATUS.md`
- `rg -n -F -e 'autoplan' -e 'gstack-autoplan' skills/intuitive-flow docs/human README.md ARCHITECTURE.md STATUS.md`
- `bun test scripts/lib/default-skill-allowlist.test.ts scripts/lib/sync-local-commands-skills.test.ts`
- `bun run check:skills`
- `bun run verify`

## Vertical Slices

1. Update human docs to make the staged workflow canonical and record the new
   public skill roles, including `agent-planning-loop`.
2. Add explicit repo/plan mode routing to `intuitive-reduce-entropy` and its
   human prompt docs.
3. Move `gstack-autoplan` semantics into the planning stage as a non-silent
   unknown-unknown scout and document the report shape.
4. Refocus `intuitive-flow` plan-intake language around router/executor
   responsibility and preflight as the execution boundary, including replacing
   mandatory `autoplan` precheck language with planning-stage scout checks.
5. Rename `skills/intuitive-planning-loop/` to
   `skills/agent-planning-loop/`, update frontmatter, references, docs, and
   `scripts/default-skill-allowlist.txt`, then add `legacy-skill
   intuitive-planning-loop`.
6. Run targeted allowlist/sync tests, skill checks, and full verification.
7. Refresh this plan's status with shipped evidence or remaining follow-ups.

All vertical slices are implemented as of 2026-06-12.

## Risks And Assumptions

- Renaming an installed root skill can leave stale local installs unless the
  default allowlist and legacy cleanup entries are updated together.
- Existing docs, tests, and helper scripts may parse the old skill name.
- The mode split in `intuitive-reduce-entropy` should stay lightweight; if it
  becomes a second large workflow, a separate skill may be cleaner.
- The final wording should not make every small task require the full staged
  workflow; tiny concrete edits can still route directly.
- Permanent aliasing would reduce immediate migration risk but recreate the
  exact ambiguity this refactor is meant to remove.
- The grep checks should allow `intuitive-planning-loop` only in this plan,
  migration notes, and the `legacy-skill` entry after implementation.
- Moving `autoplan` out of Flow execution changes Flow's execution contract;
  the implementation must preserve an explicit planning-stage scout route for
  users who want the extra blind-spot review.
- Running `autoplan` during planning is acceptable only if it is explicit,
  bounded, non-canonical until reconciled, and reported to the user with its
  effect on scope, risk, tests, and execution.

## Plan Entropy Loop Notes

Round 1, 2026-06-12:

- Clarified that the planning-loop rename is a forward migration with legacy
  cleanup, not an open-ended alias choice.
- Added explicit reduce-entropy mode defaults so plan mode and repo mode are
  selected by prompt shape instead of hidden inference.
- Added Flow compatibility-router wording so vague prompts are routed upstream
  without hidden idea shaping.
- Added allowlist and local-sync test coverage because the rename changes the
  installed root-skill surface, not only prose.

Round 2, 2026-06-12:

- Clarified that approved grill-batch plus preflight replaces mandatory
  `autoplan` evidence for plan-backed Flow execution.
- Preserved `gstack-autoplan` only as optional external review or compatibility
  intake whose accepted decisions must be reconciled into the plan.

Grill batch 1, 2026-06-12:

- Accepted hard rename to `agent-planning-loop` without a long-lived installed
  alias.
- Accepted that approved preflight must be reconciled into the canonical plan
  before plan-backed Flow execution.
- Accepted no ADR by default.
- Accepted `gstack-autoplan` as a planning-stage unknown-unknown scout for
  non-trivial plan-backed work, with a non-silent impact report and no direct
  canonical plan mutation.

Saturation check:

- Stop once the plan names the target workflow contract, rename migration
  strategy, mode-selection rule, Flow compatibility behavior, verification
  gates, allowed old-name references, and the autoplan compatibility boundary.

## GSD Handoff Trigger

```text
existing phase: gsd-plan-phase <phase> --prd docs/plans/refactor-workflow-stage-boundaries.md
missing planning or phase: manifest + gsd-ingest-docs, then gsd-plan-phase --prd docs/plans/refactor-workflow-stage-boundaries.md
```

## Historical Preflight Contract

Preflight status: IMPLEMENTED (original draft retained as execution evidence)
Task source: plan path plus user discussion
Canonical source: docs/plans/refactor-workflow-stage-boundaries.md
Route: durable `$intuitive-flow`
Goal: Implement the workflow-stage-boundary refactor so the public docs and
skill contracts recommend staged planning, non-silent unknown-unknown scouting,
preflight-locked execution, and Flow as execution router.

Scope:

- Update `README.md`, `ARCHITECTURE.md`, `STATUS.md`, and relevant
  `docs/human/**` so the recommended path is:
  `plan/repo entropy -> unknown-unknown scout for non-trivial plans ->
  grill-batch -> preflight -> intuitive-flow execution`.
- Add explicit repo entropy mode and plan entropy mode selection to
  `skills/intuitive-reduce-entropy/SKILL.md` and human prompt docs.
- Move `gstack-autoplan` semantics into the planning stage as a non-silent
  unknown-unknown scout with the report shape in this plan.
- Refocus `skills/intuitive-flow/**` so Flow routes vague prompts upstream,
  treats approved preflight as the execution contract, and does not run
  autoplan as a hidden execution gate.
- Rename `skills/intuitive-planning-loop/` to `skills/agent-planning-loop/`,
  update frontmatter, docs, references, command examples, and
  `scripts/default-skill-allowlist.txt`; add `legacy-skill
  intuitive-planning-loop`.
- Update targeted tests only where the rename or route contract needs coverage.
- Refresh this plan with implementation status, shipped evidence, and remaining
  follow-ups before closeout.

Non-goals:

- Do not implement unrelated skill simplification or broad repo cleanup.
- Do not redesign GSD, skill-runner, Multica goal tracking, or external
  gstack/autoplan internals.
- Do not keep a long-lived installed `intuitive-planning-loop` alias unless a
  concrete compatibility blocker is found and recorded.
- Do not create an ADR unless implementation uncovers a durable trade-off not
  already resolved by this plan and `ARCHITECTURE.md`.

Context:

- original must-read=`docs/plans/refactor-workflow-stage-boundaries.md`,
  `README.md`, `ARCHITECTURE.md`, `STATUS.md`,
  `docs/human/reduce-repo-entropy.md`,
  `docs/human/skill-self-improvement-audit.md`,
  `skills/intuitive-reduce-entropy/SKILL.md`,
  `skills/intuitive-flow/SKILL.md`,
  `skills/intuitive-flow/references/plan-intake-and-autoplan.md`,
  `skills/intuitive-flow/references/gsd-handoff.md`,
  `skills/intuitive-flow/references/source-of-truth.md`,
  `skills/agent-planning-loop/SKILL.md`,
  `skills/intuitive-preflight/SKILL.md`,
  `scripts/default-skill-allowlist.txt`,
  `scripts/lib/default-skill-allowlist.test.ts`,
  `scripts/lib/sync-local-commands-skills.test.ts`.
- useful=`skills/intuitive-flow/references/checkpoints-and-auto-run.md`,
  `skills/intuitive-flow/references/refactor-and-closeout.md`,
  `skills/intuitive-flow/references/output-shapes.md`,
  `docs/human/agent-harness-references.md`,
  `skills/intuitive-init/SKILL.md`.
- avoid-unless-needed=`vendor/**`, `docs/release-notes/**`, generated outputs,
  installed user-level skill directories, broad history, and unrelated tests.

Acceptance:

- SUCCESS: Human docs and skill contracts consistently present staged planning,
  explicit repo/plan entropy modes, `gstack-autoplan` as planning-stage
  unknown-unknown scout, preflight as the execution contract boundary, and
  Flow as execution router; installed root skill surface uses
  `agent-planning-loop` and cleans up `intuitive-planning-loop` as legacy.
- BLOCKED_NEEDS_DECISION: concrete external compatibility blocker requires
  keeping a long-lived installed alias, or implementation discovers a durable
  ADR-worthy trade-off not covered by this plan.
- BLOCKED_NEEDS_LOCAL_VALIDATION: local `bun run verify` or targeted sync tests
  cannot run in the current environment.
- INTERMEDIATE_ONLY: none unless explicitly approved.
- No regressions: default skill allowlist validation, local skill sync behavior,
  frontmatter checks, local resource-reference checks, ShellCheck, TypeScript,
  and test suite still pass.

Verification:

- deterministic=`bun run check:skills`, `bun run check:shell`,
  `bun run check`, `bun test scripts/lib/default-skill-allowlist.test.ts
  scripts/lib/sync-local-commands-skills.test.ts`, `bun run verify`.
- integration=`rg -n -F -e 'intuitive-planning-loop' -e 'planning-loop' -e
  'default shaping/build/change' README.md ARCHITECTURE.md STATUS.md docs/human
  skills scripts/default-skill-allowlist.txt`; `rg -n -F -e
  'agent-planning-loop' README.md ARCHITECTURE.md STATUS.md docs/human skills
  scripts/default-skill-allowlist.txt`; `rg -n -F -e 'repo entropy mode' -e
  'plan entropy mode' skills/intuitive-reduce-entropy docs README.md
  ARCHITECTURE.md STATUS.md`; `rg -n -F -e 'autoplan' -e 'gstack-autoplan'
  skills/intuitive-flow docs/human README.md ARCHITECTURE.md STATUS.md`.
- product-run=`./scripts/update.sh` dry-run is not available; use the existing
  local sync tests as the runnable proof for installed skill surface changes.
- local-live-manual=optional manual install/update run only if the maintainer
  wants to validate user-level tooling mutation; not required for merge because
  `scripts/update.sh` writes outside the repo.
- optional=`bun run audit:skill-upstreams` if external skill surface wording is
  touched.

Execution:

- main=supervise route, inspect diff, ensure plan freshness, verify owned
  changes, and keep unrelated worktree changes untouched.
- worker=skill-runner worker recommended because this is a multi-file
  plan-backed refactor touching docs, skill contracts, allowlist, and tests.
- worker-goal=Implement `docs/plans/refactor-workflow-stage-boundaries.md`:
  update human docs, reduce-entropy modes, autoplan unknown-unknown scout
  semantics, Flow execution-router/preflight boundary, `agent-planning-loop`
  rename plus allowlist legacy cleanup, targeted tests, verification, and plan
  freshness.

Historical execution request: `/goal execute docs/plans/refactor-workflow-stage-boundaries.md with intuitive-flow`
Approval record: LGTM/approve/go ahead approved the original draft; edits requested revision before implementation.
