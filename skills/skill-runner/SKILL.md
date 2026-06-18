---
name: skill-runner
description: |
  Run a daily development task through one or more named skills in an isolated
  tmux-backed Codex or Claude session. Use when the user asks to "impl X with
  $skill", "run X via $intuitive-flow", supervise a skill-driven task,
  keep the main session clean, evaluate the run, or improve custom skills after
  a real task reveals a reusable workflow defect.
disable-model-invocation: true
---

# Skill Runner

Use this skill to run one real development task in a separate agent session
while the main session stays focused on decisions, review, and synthesis.

The default mindset is daily development, not benchmark tuning. Do not rerun the
same task just to optimize a skill. Learn from varied real tasks, and change a
skill only when a reusable workflow defect is clear.

This skill may repair itself when a real `skill-runner` run reveals a reusable
runner defect, such as false blocker classification, unsafe supervision logic,
or brittle artifact parsing. Keep those patches small and commit them separately
from product-task changes.

## Philosophy

Keep skills small, composable, and boring.

- Prefer principles over long procedures.
- Prefer stop conditions over exhaustive branching.
- Prefer one obvious path over clever options.
- Prefer scripts for deterministic mechanics.
- Prefer references only when optional detail is genuinely needed.
- Prefer deleting or shortening stale guidance over adding more rules.
- Do not encode task-specific lessons as universal rules.
- Do not add a rule unless it prevents a repeated or high-severity failure.
- When a better model can infer it from context, leave it out.

## Default Flow

1. Parse the user task and selected skills.
2. Choose the task workspace: the repo where the user prompt was triggered,
   unless the user explicitly names a different target repo. Do not switch to
   the custom skill source repo merely because a selected skill may be inspected
   or patched.
3. Run the skill-runner script from the Intuitive Flow checkout with the
   original prompt and that workspace as `--cwd`.
4. Wait for the tmux session to finish.
5. Read only the compact run artifacts first: `result.md`, `eval.md`, and the
   worker's final message. Read `skill-review.md` when deciding whether this
   run exposed reusable skill changes.
6. Inspect the actual diff and verification output before trusting the result.
7. Apply follow-up fixes in the main session only when needed.
8. Consider skill changes only for reusable workflow defects.

Do not paste the whole worker transcript into the main context. Use the run
artifacts and targeted searches through logs.

## Umbrella Skill Usage

Umbrella skills such as `$intuitive-flow` and `$intuitive-reduce-entropy` may
use this runner as the isolation backend for durable, artifact-sensitive, or
long-running skill work. The main session should stay responsible for route
decisions, source-of-truth edits, integration, and final verification.

Codex delegation policy lives in
[references/codex-delegation.md](references/codex-delegation.md). Other skills
should link to that reference instead of repeating host-specific Paseo,
native-subagent, model, or fallback rules. This runner remains the isolation
backend for durable or artifact-sensitive sub-phases.

Do not assume a separate git worktree or custom model selection for runner jobs.
Organize work to be safe in the current worktree unless the user chose a
different workspace.

For long-running umbrella runs, the parent skill may create a repo-local
progress file at `docs/status/active/<task-slug>.md`. Runner artifacts are
usually enough.

The script's `RESULT_STATUS` final response is the machine-readable status
contract, but the main session must inspect compact artifacts and actual diff
before trusting it.

Every completed run writes `skill-review.md` as the default post-run skill
feedback artifact. It records the selected skills, the worker's
`SKILL_BEHAVIOR_NOTES`, repo-local skill diffs, shared custom-skill diffs, and a
conservative recommendation such as `NO_SKILL_CHANGE`, `CANDIDATE_LEARNING`, or
`REVIEW_REQUIRED`. Treat it as an options list for the human or supervising
session, not permission for the runner to patch skills automatically.

## Command

From the repo where the task should run:

```bash
python3 /path/to/intuitive-flow/skills/skill-runner/scripts/run_skill_runner.py \
  --agent <codex|claude> \
  --cwd "$PWD" \
  -- \
  'impl <task> with $intuitive-flow then run $intuitive-refactor changed-code review'
```

The selected skill must be applied to the `--cwd` workspace. If a run in a
product repo reveals a reusable custom-skill defect, keep the product run
grounded in that repo and patch `/path/to/intuitive-flow/skills/...` as a
separate follow-up. Use the Intuitive Flow checkout as `--cwd` only when the
task is solely custom skill maintenance.

Use script help for the option surface instead of memorizing it:
`python3 .../run_skill_runner.py --help`. Common options are `--agent`,
`--cwd`, `--timeout-min`,
`--idle-timeout-min`, `--owned-path`, `--dry-run`, `--finalize-run`,
and `--dangerous`.

For goal-driven `intuitive-flow` sub-phases, set a babysitter review cadence
from the task: short for small edits, longer for broad refactors or slow proof.
This is a steering cadence, not a hard timeout.

Batch review helper:

```bash
python3 /path/to/intuitive-flow/skills/skill-runner/scripts/summarize_skill_runner_runs.py \
  --since 2026-06-03
```

The summary reports status counts, result/worker `RESULT_STATUS` mismatches,
and skill-review recommendations without loading full transcripts.

The script writes run artifacts under `~/.cache/skill-runner/runs/` by default.

## Supervisor Mechanics

The runner treats the worker's final `RESULT_STATUS` as authoritative:

- `SUCCESS` maps to a successful run even if the CLI emitted noisy logs.
- `PARTIAL` means useful work landed but follow-up remains.
- `BLOCKED_NEEDS_DECISION` maps to `BLOCKED` even when the CLI exits 0.
- `FAILED` maps to `FAILED` even when the CLI exits 0.

Runs normalize status through compact artifacts. Automatic blocker detection is
intentionally narrow so normal docs mentioning auth, API keys, or setup do not
look like live failures. Inspect `terminal.log` only when debugging a run.

For goal-driven workers, the main session should choose a review cadence before
launch and adjust it when task evidence changes. Do not stop a healthy
long-running run merely because it is old. Stop only when it is making no
meaningful durable progress, pursuing the wrong artifact, looping, or expanding
scope. Use captured logs, current diff, commits, and the canonical artifact to
decide whether to continue, steer with a follow-up prompt, or kill and relaunch
with a corrected goal.

`run.json` records the selected agent, workspace, owned paths, and whether the
runner used the dangerous no-sandbox flag.

## Prompt Rewrite Rules

The worker prompt should be compact and explicit:

- Objective
- Selected skills
- Scope and non-goals
- Context package
- Acceptance contract
- KISS / Zen constraints
- Source-of-truth rules
- Stop conditions
- Verification required
- Final output shape

Acceptance contract must name `SUCCESS only if`, `PARTIAL if`,
`BLOCKED_NEEDS_DECISION if`, and `Must not regress`. If the user's prompt or
approved plan does not contain task-specific acceptance criteria, the worker
must not silently invent a broad success definition. It should stop with
`BLOCKED_NEEDS_DECISION` or return a recommended contract for main-session
approval.

Context package should name what the worker must inspect first and what should
stay out unless needed. If required files, issue, plan, logs, artifacts, or
commands are unknown, stop with `BLOCKED_NEEDS_DECISION` or propose
`$intuitive-preflight`.

For `$intuitive-flow`, require coherent phase scope. For `$intuitive-refactor`
changed-code review, review the actual diff or path only.

## Run Evaluation

Classify the run separately from the task result:

- `SUCCESS` - worker completed and evidence supports the claim.
- `PARTIAL` - useful work landed but follow-up is needed.
- `BLOCKED` - worker stopped on a real blocker or needed a decision.
- `FAILED` - worker errored, looped, or made unsafe/unusable changes.

Evaluate behavior using stable invariants that apply across different tasks:

- kept one source of truth
- preserved unrelated changes
- kept scope small
- used named skills honestly
- avoided micro-phase drift
- verified claims with relevant evidence
- stopped or escalated on blockers
- committed only when appropriate
- did not edit custom skills unless explicitly justified

## Skill Change Policy

Default verdict: `NO_SKILL_CHANGE`.

The default storage location for skill-performance feedback is the run's
`skill-review.md`. Use it when reviewing one run or batch-reviewing many runs.

Runner-generated recommendations are advisory. A human or supervising session
chooses whether to record a learning, patch a repo-local skill, patch a shared
custom skill, or fix runner mechanics.

Only patch a skill when the run reveals a reusable workflow defect:

- the skill directly caused bad behavior
- the missing guardrail is general, not task-specific
- the patch can be small
- the patch makes the skill simpler or safer
- the patch is likely to help future varied tasks

Prefer these outcomes, in order:

1. `NO_SKILL_CHANGE`
2. `CANDIDATE_LEARNING` - record, do not edit yet
3. `DELETE_OR_SIMPLIFY`
4. `SMALL_GENERAL_RULE`
5. `MOVE_TO_REFERENCE`
6. `SCRIPT_MECHANIC`

Keep reusable behavior changes in surfaces the project owns. If a needed policy
depends on third-party or system skill behavior, wrap it locally or document the
local policy unless the task is explicitly upstream maintenance.

Before editing a skill, ask:

- Can this be solved by deleting or shortening stale instructions?
- Can optional detail move to a reference file?
- Can deterministic mechanics move to a script?
- Is this actually a one-off task issue?
- Will this rule still help a stronger future model, or should the skill state
  the principle and leave the tactic open?

After a custom skill change, keep the boundary clear:

- Edit the repo-owned source surface, not an installed copy.
- Run the relevant verification for the changed skill or runner script.
- Sync installed local skills only when intentionally refreshing user-level
  tooling.
- Commit separately from product-task changes only when the user or repo
  workflow asks for a commit.

When side effects are intended, `scripts/tasks/sync-local-commands-skills.sh`
refreshes installed local skill surfaces. Stage only owned skill changes and use
a commit message that names the skill change.

## Stop Conditions

Stop for a human decision when:

- the worker asks for approval that cannot be answered safely
- the task needs credentials, paid APIs, local hardware, Docker, or GPU and the
  user did not authorize that gate
- the worker tries to broaden scope beyond the prompt
- a goal-driven worker has passed a babysitter review interval without durable
  progress, is clearly pursuing the wrong artifact, or has made progress only
  by expanding scope
- more than three phases would be created from one prompt without approval
- the same error repeats
- the worker edits unrelated files
- the worker starts editing skills without a reusable skill-failure rationale

## Final Response

Report:

- tmux session name and run directory
- task result
- verification run
- changed files or commit
- skill-change verdict
- any remaining decision needed
