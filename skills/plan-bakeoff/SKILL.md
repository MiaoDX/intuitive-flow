---
name: plan-bakeoff
description: |
  Run one approved implementation plan through multiple isolated candidate
  worktrees, then compare artifacts and rank the results. Use for best-of-N
  implementation or agent/model/harness bakeoffs against one shared baseline.
---

# Plan Bakeoff

`plan-bakeoff` owns candidate fanout, a shared committed baseline, isolated
worktrees, scorecards, and the final comparison. `skill-runner` remains the
single-worker primitive and owns agent lifecycle and compact worker artifacts.

## Required Input

Require:

- target git repo;
- approved plan or equivalent execution contract;
- two or more candidates, normally through a JSON manifest;
- explicit stop gates such as `do not port`, `keep worktrees`, or `dry-run`.

Infer setup and verification from target-repo guidance. If the repo lacks
enough information for comparable candidates, report a blocker instead of
inventing a one-off SOP.

## Safety

- Resolve every candidate from the same committed base ref.
- Keep worktrees and artifacts isolated; never inherit unrelated dirty state.
- Never write global agent configuration or copy secret values into artifacts.
- Require explicit approval before real provider/model calls.
- Fail loudly on missing setup, submodules, assets, runtimes, or env key names.
- Do not auto-port, merge, or push a winner. Recommend
  `$intuitive-port-worktree` after the user selects one.

## Run

The runner CLI owns manifest fields, candidate options, timeouts, and current
harness/model support. Read its help instead of relying on copied examples:

```bash
bash skills/plan-bakeoff/scripts/run_plan_bakeoff.sh --help
```

Normal sequence:

1. Read the approved plan and target repo guidance.
2. Generate or review a proposal with `--propose`.
3. Confirm all candidates share the same base, setup, and verification rubric.
4. Run `--dry-run`; it must not call real providers.
5. Run fake candidates, or use `--execute-real` only after explicit approval.
6. Inspect `final-report.md`, scorecards, worker results, diffs, and proof logs.
7. Recommend a winner and useful isolated ideas from non-winners.

Candidates run in parallel by default. Change that only for harness debugging
or a real resource constraint. Environment preparation is a shared baseline,
not part of the model-quality score.

## Judge Rubric

Rank with concrete diff and proof evidence:

1. Completes the approved acceptance contract.
2. Respects repo architecture, commands, environment, and source-of-truth rules.
3. Produces the smallest maintainable implementation without speculative
   compatibility.
4. Runs relevant focused proof and explains skipped gates.
5. Keeps the diff free of unrelated files, generated noise, and secrets.
6. States blockers and partial results precisely.
7. Offers independently useful cherry-pick ideas.

A smaller verified candidate that fully matches the plan ranks above a broader
unverified rewrite.

## Output And Stops

The runner writes a normalized manifest, per-candidate JSON/Markdown
scorecards, and `final-report.md`. The final response should include ranking,
status and elapsed time, verification, key diff facts, cherry-pick ideas,
rejected candidates, and the recommended next action.

Stop before real provider calls, global config changes, secret exposure,
auto-porting, auto-merging, pushing, or importing target-specific provider
registries without approval.
