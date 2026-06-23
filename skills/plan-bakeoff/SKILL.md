---
name: plan-bakeoff
description: |
  Run one approved implementation plan through multiple isolated candidate
  worktrees, each with its own agent harness/model/profile, then compare
  artifacts and rank the results. Use when the user asks for best-of-N plan
  execution, model or harness bakeoffs, parallel candidate worktrees, fast-model
  implementation with stronger-model judging, or safe evaluation of Codex,
  Claude Code, MiMo, Kimi, MiniMax, or custom coding-agent routes against the
  same real project plan.
---

# Plan Bakeoff

Use this skill to orchestrate one accepted plan across multiple independent git
worktrees. Keep `skill-runner` as the single-worker primitive; this skill owns
the fanout, shared baseline, candidate manifest, scorecards, and final report.

## User Prompt Contract

Keep user-facing bakeoff prompts short. The user should only need to name:

- target repo
- accepted plan path or equivalent approved contract
- candidate set or env/config file that implies the candidate set
- any explicit stop gates such as "do not port", "keep worktrees", or
  "dry-run first"

Do not ask the user to paste environment setup instructions, verification
rubrics, scoring criteria, or repo-specific preflight commands into the prompt.
Infer those from this skill, the target repo guidance, and the accepted plan.
If the target repo lacks enough guidance to prepare comparable worktrees, record
that as a bakeoff blocker instead of expanding the prompt into a one-off SOP.

## Safety Model

- Require an approved plan or equivalent execution contract before launching
  mutating candidates.
- Start all candidates from the same base ref.
- Keep candidate worktrees isolated from each other.
- Never write global Codex or Claude configuration.
- Never copy `.env` into run artifacts; source env files only in process memory.
- Name provider profiles and env keys, not secret values.
- Do not run real provider/model candidates unless the user explicitly approves
  that gate for the current run.
- Do not auto-port or auto-merge winners. Recommend `$intuitive-port-worktree`
  after the user selects a result.

## Default Flow

1. Read the accepted plan.
2. Read the target repo's agent guidance and discover repo-local setup/test
   commands before inventing any environment steps.
3. Copy `.plan-bakeoff.env.example` to `.plan-bakeoff.env` if needed, then fill
   only local API keys. `.plan-bakeoff.env` is gitignored and must not be
   committed.
4. Ask for a proposal:

   ```bash
   bash skills/plan-bakeoff/scripts/run_plan_bakeoff.sh --manifest <manifest> --propose
   ```

5. Let the user accept or edit the manifest.
6. Dry-run the manifest:

   ```bash
   bash skills/plan-bakeoff/scripts/run_plan_bakeoff.sh --manifest <manifest> --dry-run
   ```

   Dry-run must not launch real providers, so it does not require
   `--execute-real`.

7. Execute fake candidates, or real candidates only after explicit approval:

   ```bash
   bash skills/plan-bakeoff/scripts/run_plan_bakeoff.sh --manifest <manifest> --execute
   bash skills/plan-bakeoff/scripts/run_plan_bakeoff.sh --manifest <manifest> --execute --execute-real
   ```

8. Inspect the final report, candidate scorecards, and worker artifacts.
9. Recommend a winner, cherry-pick ideas, rejected candidates, and next action.

Execution launches candidates in parallel by default from the same resolved
base ref. The runner gives each candidate a one-hour budget plus a grace window
instead of using a short fixed stop, because bakeoff should compare
implementations rather than filter out slower-but-promising routes.

## Environment Discovery Defaults

Treat environment preparation as a target-repo contract, not as user prompt
content and not as part of the model-quality score.

Before launching candidates:

- Read the target repo's mandatory orientation files and follow only the setup
  links needed for this plan.
- Prefer repo-provided preflight/bootstrap/test wrappers over ad hoc commands.
- If the repo provides worktree-specific readiness commands, run those before
  real candidates and include them in shared verification when appropriate.
- Use one committed base ref for all candidates. Do not include unrelated dirty
  checkout state in candidate baselines.
- Source env files only in process memory. Report missing keys by name, never by
  value.
- If setup, submodules, assets, or required local runtimes are missing, fail
  loudly and record the affected candidates as blocked. Do not substitute
  system Python, fallback providers, or weaker verification just to keep a run
  moving.

The goal is to compare implementation quality after a fair shared baseline, not
to reward whichever model guesses the local machine best.

## Default Judge Rubric

Use this rubric when comparing candidate diffs and writing the final human
recommendation. Prefer concrete file/diff/test evidence over broad impressions.

1. Plan acceptance completeness: implements the accepted plan's required
   behavior and does not skip explicit acceptance criteria.
2. Repo contract alignment: respects target repo architecture layers, command
   grammar, environment rules, safety constraints, and source-of-truth docs.
3. Minimality and maintainability: keeps the diff scoped, removes avoidable
   complexity, names concepts clearly, and avoids speculative compatibility
   shims.
4. Verification quality: runs focused relevant checks, explains skipped checks,
   and leaves reproducible evidence.
5. Diff cleanliness: avoids unrelated files, generated noise, secret exposure,
   broad formatting churn, and broken worktree state.
6. Failure clarity: blocked or partial candidates state the real blocker,
   affected files, and next recovery step without hiding behind generic model
   failure.
7. Cherry-pick value: preserve isolated ideas from non-winning candidates when
   they improve the selected implementation.

Rank successful candidates by this rubric after considering verification
results. A smaller verified implementation that fully matches the plan should
rank above a broader unverified rewrite.

## Final Comparison Shape

After execution, inspect `final-report.md`, each scorecard, diffs, verification
logs, and worker artifacts. Return a concise comparison with:

- ranking and recommended winner
- per-candidate status and elapsed time when available in artifacts
- what changed and whether verification passed
- useful cherry-pick ideas
- rejected or blocked candidates with concrete reasons
- recommended next action, usually `$intuitive-port-worktree` for the selected
  result

Do not auto-port, auto-merge, or push target-repo changes from a bakeoff unless
the user explicitly asks after reviewing the recommendation.

## Candidate Policy

Use JSON manifests. YAML support is intentionally parked for v0 so the runner
does not own a partial parser.

Required top-level fields:

- `schema`: `plan_bakeoff_manifest_v1`
- `target_repo`: target git repository path
- `plan`: plan file path, relative to `target_repo` unless absolute
- `candidates`: two or more candidates

Optional fields:

- `base.ref`: base ref for all worktrees, default `HEAD`
- `base.mode`: legacy no-op compatibility field. Candidates are always created
  from the resolved committed `base.ref`; dirty files in the source checkout are
  not inherited.
- `run_root`: run artifact root
- `worker_goal`: explicit first instruction for each candidate worker when the
  task must trigger a goal-style skill route, for example
  `/goal execute docs/plans/example.md with intuitive-flow`.
- `worktree_setup.commands`: shell commands to run in each candidate worktree
  after worktree creation and before worker launch. Use this for repo-local
  bootstrap, readiness checks, submodule/assets setup, or any target-repo
  preparation that should be shared and judged separately from model quality.
  Commands may be strings or objects:
  `{ "id": "readiness", "command": "...", "artifact": "readiness.json",
  "artifact_stream": "stdout", "required": true }`.
  `artifact` paths are relative to the candidate artifact directory.
  `artifact_stream` is `stdout`, `stderr`, or `combined`; default is
  `combined`. `required` defaults to true. A required setup failure marks that
  candidate `BLOCKED`, saves setup evidence, keeps its worktree for inspection,
  and does not launch the worker.
- `verification.commands`: shared post-run commands
- `execution.parallel`: run candidates concurrently, default `true`; set
  `false` only for harness debugging.
- `execution.worker_timeout_min`: per-candidate work budget before grace,
  default `60`.
- `execution.timeout_grace_min`: additional per-candidate grace window,
  default `15`.
- `execution.idle_timeout_min`: no-output stop budget, default `20`.

Candidate fields:

- `id`: run-local id.
- `harness`: `fake`, `codex-cli`, `claude-code`, or `command`.
- `command`: shell command for `harness=command`. The command runs in the
  candidate worktree, receives the worker prompt on stdin, and should emit a
  `RESULT_STATUS: SUCCESS|PARTIAL|BLOCKED|FAILED` line for best scoring. Use
  this when the local route already has its own launcher and plan-bakeoff
  should not understand its provider/runtime details.
- `provider_profile`: route/profile name such as `codex-router-responses`.
- `model`: model id or route default.
- `required_env`: env key names that must be present.
- `env`: optional map from child env var name to local env var name.
- `command_profile`: deterministic command template.
- `runtime`: `host`; Docker is intentionally unsupported in v0.
- `skills`: skills expected in the candidate worker environment.
- `worktree_setup.commands`: extra per-candidate setup commands appended after
  shared setup commands.
- `timeout_min`, `idle_timeout_min`, `timeout_grace_min`: candidate-specific
  timing overrides for unusually large or tiny tasks.

Example:

```json
{
  "schema": "plan_bakeoff_manifest_v1",
  "target_repo": ".",
  "plan": ".planning/example-plan.md",
  "base": { "mode": "clean-head", "ref": "HEAD" },
  "verification": {
    "commands": ["bun test"]
  },
  "candidates": [
    {
      "id": "fake-a",
      "harness": "fake",
      "provider_profile": "fake",
      "model": "fake",
      "command_profile": "fake-success"
    },
    {
      "id": "fake-b",
      "harness": "fake",
      "provider_profile": "fake",
      "model": "fake",
      "command_profile": "fake-partial"
    }
  ]
}
```

For real candidates, first prove route readiness. Treat tool-call transport,
image transport, and harness behavior as route properties, not model properties.
The built-in proposal is deliberately small:

- `codex-gpt-5.5`: `codex-cli`, `gpt-5.5`, requiring `CODEX_BASE_URL` and
  `CODEX_API_KEY`.
- `codex-gpt-5.3-codex`: `codex-cli`, `gpt-5.3-codex`, requiring
  `CODEX_BASE_URL` and `CODEX_API_KEY`.
- `codex-minimax`: `codex-cli`, `MiniMax-M3`, requiring `MM_API_KEY`.
- `claude-mimo-1000`: `claude-code`, MiMo 1000 UltraSpeed, requiring
  `MIMO_API_KEY` and `MIMO_BASE_URL`. This route may identify as
  `mimo-v2.5-pro`; treat that as the same UltraSpeed route. Its context window
  is 256k.
- `claude-kimi`: `claude-code`, `kimi-k2.7-code`, requiring `KIMI_API_KEY`.
- `claude-minimax`: `claude-code`, `MiniMax-M3`, requiring `MM_API_KEY`.
- `claude-mimo-v2.5`: `claude-code`, `mimo-v2.5`, requiring `MIMO_TP_KEY`.

Real candidate example:

```json
{
  "id": "codex-gpt-5.5",
  "harness": "codex-cli",
  "provider_profile": "codex-router-responses",
  "model": "gpt-5.5",
  "required_env": ["CODEX_BASE_URL", "CODEX_API_KEY"],
  "env": {
    "CODEX_BASE_URL": "CODEX_BASE_URL",
    "CODEX_API_KEY": "CODEX_API_KEY"
  }
}
```

## Output

The runner writes:

- `manifest.json` - normalized manifest without secret values.
- `candidates/<id>/scorecard.json`
- `candidates/<id>/scorecard.md`
- `final-report.md`

Final report categories:

- `winner`
- `mergeable_with_fixes`
- `cherry_pick_ideas`
- `reject`
- one candidate summary table with rank, candidate id, status, provider
  config, running time, verification counts, diff stats, ranking reason, and
  worktree
- verification summary
- recommended `$intuitive-port-worktree` handoff

## Stop Gates

Stop for the user before real provider calls, global config changes, secret
exposure, auto-porting, auto-merging, or importing target-repo-specific
provider registries.
