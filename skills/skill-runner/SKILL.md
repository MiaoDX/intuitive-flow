---
name: skill-runner
description: |
  Run a bounded development task through named skills in an isolated,
  tmux-backed Codex or Claude session. Use for durable or artifact-sensitive
  worker phases, supervised skill runs, and post-run skill evaluation.
---

# Skill Runner

Use `skill-runner` when an isolated worker needs durable logs, compact result
artifacts, explicit path ownership, or supervision across a long task. Small
read-only probes and tiny edits should stay on the host-approved lighter route.

Read `references/codex-delegation.md` before choosing a Codex worker surface.
That file is the canonical policy for Paseo probing, native subagent
disablement, and tmux fallback.

## Launch Contract

Before launch, define:

- objective and named skills;
- owned paths and non-goals;
- the smallest context package;
- task-specific acceptance and verification;
- stop conditions and final `RESULT_STATUS` contract;
- review cadence for long-running work.

Use the runner's own help as the option source of truth:

```bash
uv run python skills/skill-runner/scripts/run_skill_runner.py --help
```

Codex prompt workers inherit the current Codex provider configuration and auth
by default. This keeps ordinary supervised runs on the same working route as
the parent session. Provider bakeoffs must pass `--codex-config-mode isolated`;
that mode ignores user config and uses the explicit provider, base URL, env-key,
and wire-API arguments supplied by the bakeoff runtime.

Launch from the target repo and pass the worker prompt after `--`. Use
`--dry-run` first when validating a new agent, model, launch mode, or ownership
split. Use `--dangerous` only with explicit authorization. Do not infer missing
acceptance criteria or credentials just to make a worker start.

The script writes runs under `~/.cache/skill-runner/runs/` by default. Inspect
compact artifacts before full logs:

- `result.md`: normalized task result and blocker reason;
- `eval.md`: scope, diff, proof, and ownership review;
- `skill-review.md`: reusable skill feedback, advisory only;
- `run.json`: selected agent, workspace, owned paths, and sandbox posture;
- `terminal.log`: debugging evidence when compact artifacts disagree.

For batch review, use the summarizer's help rather than duplicating its options
here:

```bash
uv run python skills/skill-runner/scripts/summarize_skill_runner_runs.py --help
```

## Supervision

Keep the main session responsible for requirements, route decisions,
integration, actual diff review, and final verification. A completion notice is
not proof. Compare the worker result with compact artifacts, current git diff,
commits, and required tests.

Workers return evidence to the task control plane. They must not edit a
project-status surface unless the task explicitly assigns project-integrator
ownership.

Treat the worker's explicit status as authoritative when artifacts agree:

- `SUCCESS`: accepted behavior and proof are complete.
- `PARTIAL`: useful work landed, but named follow-up remains.
- `BLOCKED_NEEDS_DECISION`: a real user or environment decision is required.
- `FAILED`: the worker errored, looped, or produced unusable/unsafe work.

Steer or stop a worker when it expands scope, edits unowned paths, repeats the
same failure, makes no durable progress, or pursues the wrong artifact. Do not
kill a healthy worker only because it is old or temporarily quiet.

## Prompt Invariants

The worker prompt must state `SUCCESS only if`, `PARTIAL if`,
`BLOCKED_NEEDS_DECISION if`, and `Must not regress`. It should name current
source-of-truth files, required proof, and the expected final artifact. For
`$intuitive-flow`, give one coherent approved phase. For changed-code review,
give the actual diff or owned paths.

Prefer realistic dependencies and repo commands. Stub only genuinely external
or expensive boundaries. Never place secrets in prompts or artifacts; name
required environment keys only.

## Skill Feedback

Default verdict: `NO_SKILL_CHANGE`. Runner recommendations do not authorize
skill edits. Patch a skill only when the run proves a small, reusable workflow
defect caused by that skill. Prefer deletion, a shorter rule, a reference move,
or deterministic script mechanic over more prose.

Edit repo-owned skill sources, not installed mirrors. After an approved skill
change, run focused verification and sync user-level installs only when the
user requested that side effect.

## Stop And Report

Stop for a human decision when credentials, paid services, hardware, broad
scope, destructive behavior, public contracts, or unowned files are required.

Report the tmux session/run directory, normalized task result, verification,
changed paths or commit, skill-change verdict, and remaining decision.
