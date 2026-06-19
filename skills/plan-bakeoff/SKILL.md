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
2. Copy `.plan-bakeoff.env.example` to `.plan-bakeoff.env` if needed, then fill
   only local API keys. `.plan-bakeoff.env` is gitignored and must not be
   committed.
3. Ask for a proposal:

   ```bash
   bash skills/plan-bakeoff/scripts/run_plan_bakeoff.sh --manifest <manifest> --propose
   ```

4. Let the user accept or edit the manifest.
5. Dry-run the manifest:

   ```bash
   bash skills/plan-bakeoff/scripts/run_plan_bakeoff.sh --manifest <manifest> --dry-run
   ```

6. Execute fake candidates, or real candidates only after explicit approval:

   ```bash
   bash skills/plan-bakeoff/scripts/run_plan_bakeoff.sh --manifest <manifest> --execute
   bash skills/plan-bakeoff/scripts/run_plan_bakeoff.sh --manifest <manifest> --execute --execute-real
   ```

7. Inspect the final report, candidate scorecards, and worker artifacts.
8. Recommend a winner, cherry-pick ideas, rejected candidates, and next action.

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
- `base.mode`: `clean-head` or `allow-dirty-baseline`, default `clean-head`
- `run_root`: run artifact root
- `verification.commands`: shared post-run commands

Candidate fields:

- `id`: run-local id.
- `harness`: `fake`, `codex-cli`, or `claude-code`.
- `provider_profile`: route/profile name such as `codex-router-responses`.
- `model`: model id or route default.
- `required_env`: env key names that must be present.
- `env`: optional map from child env var name to local env var name.
- `command_profile`: deterministic command template.
- `runtime`: `host`; Docker is intentionally unsupported in v0.
- `skills`: skills expected in the candidate worker environment.

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
- verification summary
- recommended `$intuitive-port-worktree` handoff

## Stop Gates

Stop for the user before real provider calls, global config changes, secret
exposure, auto-porting, auto-merging, or importing target-repo-specific
provider registries.
