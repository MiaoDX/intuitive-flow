---
name: skill-runner
description: |
  Run a daily development task through one or more named skills in an isolated
  tmux-backed Codex or Claude session. Use when the user asks to "impl X with
  $skill", "run X via $intuitive-flow", supervise a skill-driven task,
  keep the main session clean, evaluate the run, or improve custom skills after
  a real task reveals a reusable workflow defect.
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
4. Wait for the tmux session by default, unless the user asks to detach.
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
use this runner as the isolation backend for stateful, interactive, or
long-running skill work. The main session should stay responsible for route
decisions, source-of-truth edits, integration, and final verification.

Default split:

| Work type | Preferred path |
| --- | --- |
| Read-heavy independent probes | native subagents, not tmux |
| Bounded disjoint edits | native worker subagents or one runner worker |
| Autoplan, GSD, broad refactor, or specialist pipelines | this runner |
| Multiple mutating streams in one worktree | avoid unless ownership is disjoint |

Do not assume a separate git worktree for runner jobs. Many target repos have
large dependencies or heavyweight setup, so organize work to be safe in the
current worktree by default.

Use the current CLI/model defaults for normal runner jobs. Prefer smaller or
quicker models only for clearly easy native subagent probes; the runner script
does not currently orchestrate model selection. Leave multi-run fan-out/fan-in
for a later runner feature after real tasks prove the need.

For detached or long-running umbrella runs, the parent skill may create a
repo-local progress file at `docs/status/active/<task-slug>.md`. For waited
runs, runner artifacts are usually enough.

Worker handoff shape for umbrella consumption:

```text
Scope:
Changed files:
Decisions made:
Verification:
Open risks:
Suggested next action:
```

The script's `RESULT_STATUS` final response is still the machine-readable
status contract. The main session should inspect the compact artifacts and the
actual diff before trusting that status.

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
  'impl <task> with $intuitive-flow then $simplify'
```

The selected skill must be applied to the `--cwd` workspace. If a run in a
product repo reveals a reusable custom-skill defect, keep the product run
grounded in that repo and patch `/path/to/intuitive-flow/skills/...` as a
separate follow-up. Use the Intuitive Flow checkout as `--cwd` only when the
task is solely custom skill maintenance.

Useful options:

- `--agent codex|claude` chooses the worker CLI.
- `--detach` starts tmux and returns immediately. By default, the runner
  double-forks a background supervisor that still watches the worker artifacts,
  closes interactive sessions on `RESULT_STATUS`, and rewrites `result.md` /
  `eval.md` / `skill-review.md` with the real outcome when the worker exits.
  Pass `--no-detached-supervisor` to opt out and keep the legacy
  fire-and-forget behavior (`result.md: DETACHED` can then leak).
- `--timeout-min N` caps total runtime. Default is 600 minutes, so long
  refactors and slow verification can run when the supervisor deliberately
  allows them.
- `--idle-timeout-min N` stops when logs are quiet too long.
- `--interactive --goal "..."` starts the worker in an interactive tmux agent
  session, injects `/goal ...`, sends a short task prompt pointing to
  `rewritten-prompt.md`, watches `terminal.log` for `RESULT_STATUS`, then closes
  the tmux session. The session is killed once `RESULT_STATUS` lands;
  `--clear-goal-on-exit` and `--clear-context-on-exit` send `/goal clear` or
  `/clear` into the worker *before* the kill, which only matters when the
  agent persists goal or context state outside the tmux session.
  `--goal` is only consumed when `--interactive` is also set (passing `--goal`
  alone is a silent no-op).
  For claude workers the runner auto-passes `--add-dir <run_dir>`,
  `--add-dir $HOME/.claude/jobs`, and `--add-dir $CLAUDE_JOB_DIR` (when set)
  plus `--permission-mode bypassPermissions` so the supervised worker does
  not stall on Write/Bash prompts during a detached run. Risk detection
  (`Action Required`, sandbox-loopback, auth) still fires, the rewritten
  prompt still bounds scope, and the tmux session still isolates state.
  Pass `--dangerous` to also bypass sandbox/approval at the CLI layer
  (different gate from prompts).
- For goal-driven `intuitive-flow` sub-phases, set the babysitter review
  interval from the task: 10-20 minutes for small delegated edits, 30-60 minutes
  for normal implementation, 60-120 minutes for broad refactors, or the natural
  proof checkpoint for slow verification. This is a steering cadence, not a hard
  timeout. Let healthy long-running refactors continue under the longer timeout.
- `--dangerous` lets Codex run without sandbox/approval checks. Use only when
  the surrounding environment is already trusted.
- Codex runs preflight `--sandbox workspace-write` once per host/toolchain
  fingerprint and caches the result under
  `~/.cache/skill-runner/sandbox-capability.json`. When the cache records the
  known `bwrap` loopback failure, the runner starts the worker bypassed by
  default instead of spending a doomed sandbox attempt.
- `--require-sandbox` blocks the run if the Codex sandbox is unavailable or
  cannot be proven available.
- `--refresh-sandbox-preflight` forces a fresh capability check when the host
  has changed or the cache looks stale.
- Known Codex `bwrap` loopback sandbox failures are retried once automatically
  without sandboxing when the worktree status is unchanged. Disable with
  `--no-auto-retry-sandbox-failure`.
  The retry detector checks compact worker artifacts, including
  `last-message.md`, because some Codex runs report the sandbox failure there
  even when `stderr.log` only contains transport noise.
- `--dry-run` writes the rewritten prompt and artifacts without starting tmux.
- `--finalize-run <run_dir>` rewrites compact artifacts for an existing run
  directory. Use it on older detached runs when `last-message.md` or
  `exit_code` appeared after the parent already returned `DETACHED`.
- `--owned-path <path>` can be repeated to record which paths the worker owns.
  `eval.md` then splits current diff into owned and outside-owned sections so
  supervisors can spot accidental scope expansion in dirty worktrees.

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

Exec-mode runs source `RESULT_STATUS` from the agent-written `last-message.md`.
Interactive runs detect it by scanning `terminal.log` (ANSI escape sequences
are stripped first so cursor moves and syntax-highlighting do not break the
regex), then reconstruct `last-message.md` from the terminal scrape so
downstream artifact consumers see the same shape as exec-mode runs. If tmux
disappears before the wrapper's `exit_code` file is visible, the supervisor
waits briefly for artifacts to settle and classifies from `RESULT_STATUS`
before falling back to `FAILED`.

Automatic blocker detection is intentionally narrow. In exec mode it scans
`stderr.log` only, so normal repo documentation mentioning auth, API keys, or
setup instructions does not look like a live authentication failure.
Interactive runs additionally include `terminal.log` (with ANSI stripped) so
injected slash commands and pane output participate in risk detection.
Inspect `terminal.log` manually when debugging a run.

For goal-driven workers, the main session should choose a review cadence before
launch and adjust it when task evidence changes. Do not stop a healthy
long-running run merely because it is old. Stop only when it is making no
meaningful durable progress, pursuing the wrong artifact, looping, or expanding
scope. Use captured logs, current diff, commits, and the canonical artifact to
decide whether to continue, steer with a follow-up prompt, or kill and relaunch
with a corrected goal.

Codex sandbox selection is recorded in `sandbox-preflight.md` and `run.json`.
Cache hits, preflight results, bypass decisions, and strict sandbox blocks must
leave enough audit trail for the main session to understand why the worker ran
sandboxed or bypassed.

## Prompt Rewrite Rules

The worker prompt should be compact and explicit:

- Objective
- Selected skills
- Scope and non-goals
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

For `$intuitive-flow`, require coherent phase scope. Do not create many
micro-phases unless the worker first stops and asks for grouping approval.

For `$simplify`, scope review to the actual diff or path. Do not expand into a
broad architecture review.

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
`skill-review.md`. Use that file when reviewing one run immediately or when
batch-reviewing many past runs. It should make the decision cheap:

- what skill(s) were in scope
- what the worker said about skill behavior
- whether repo-local or shared custom skill files changed
- which follow-up options are plausible

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

Useful local boundaries in this repo, when those side effects are intended:

- `scripts/tasks/sync-local-commands-skills.sh` refreshes installed local skill
  surfaces.
- Stage only the changed skill source/generated files and supporting scripts or
  docs that belong to the skill change.
- Use a commit message that names the skill change and follows the repo's
  commit policy.

## Stop Conditions

Stop or detach for a human decision when:

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
