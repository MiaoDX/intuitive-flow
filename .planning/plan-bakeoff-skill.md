---
status: DONE
created: 2026-06-19
owner: intuitive-flow
completed: 2026-06-19
---

# Plan: Plan Bakeoff Skill

## Objective

Create a `plan-bakeoff` skill that takes one approved implementation plan and
runs multiple independent coding-agent attempts against it in separate git
worktrees. Each attempt may use a different harness, provider profile, model,
reasoning setting, or runtime wrapper. The main session then compares the
attempts, selects a winner, and optionally ports the winning change back through
the normal worktree-port flow.

This is real-project best-of-N execution, not a synthetic benchmark. The plan is
the task contract, the target repo is the benchmark, and the repo's normal tests
and acceptance checks are the primary score.

## Demand Gate

Demand gate: pass.

The feature creates enough value to justify a new surface because existing
`skill-runner` deliberately owns one isolated worker for one task. The new need
is a higher-level orchestration problem:

- same plan, same base commit, multiple independent worktrees;
- different model/harness/provider candidates;
- uniform result artifacts and verification;
- strong-model judging or repair after fast-model implementation;
- no mutation of user global Codex/Claude configuration.

Extending `skill-runner` directly would make the simple daily-development
runner carry benchmark orchestration, model matrix, worktree lifecycle, and
selection policy. Keep `skill-runner` as the single-worker primitive and build a
new orchestration skill above it.

## Current Evidence

Existing local surfaces:

- `skills/skill-runner/SKILL.md` defines a single tmux-backed Codex/Claude
  worker and says not to assume separate worktrees or custom model selection.
- `skills/skill-runner/scripts/run_skill_runner.py` already supports one
  workspace and a hidden `--agent-command` escape hatch.
- `skills/skill-runner/references/codex-delegation.md` makes `skill-runner`
  the durable/stateful fallback when Paseo-style short workers are not enough.
- `skills/intuitive-port-worktree/SKILL.md` already owns porting one chosen
  worktree back into the default checkout.

Roboclaws model-routing evidence, read only for design:

- `/home/mi/ws/gogo/roboclaws/docs/human/model-matrix.md` summarizes current
  model/provider routes.
- `/home/mi/ws/gogo/roboclaws/docs/human/model-route-verdicts.yaml` records
  route health by agent engine.
- `/home/mi/ws/gogo/roboclaws/roboclaws/agents/provider_registry.py` models
  provider profiles, required env keys, default models, wire APIs, and route
  status.
- `/home/mi/ws/gogo/roboclaws/scripts/dev/coding_agent_env.sh` converts
  provider/profile env choices into Codex or Claude command arguments without
  rewriting global config.
- `/home/mi/ws/gogo/roboclaws/scripts/dev/coding_agent_docker.sh` provides a
  pinned Codex/Claude CLI image and isolated Docker home, but it is specific to
  Roboclaws.

Important route facts from Roboclaws:

- Codex CLI default route: `codex-router-responses`, model `gpt-5.5`, requiring
  `CODEX_BASE_URL` and `CODEX_API_KEY`.
- Codex CLI non-default routes there include `mimo-mify-responses` and
  `minimax-responses`, but route verdicts are not equally healthy.
- Claude Code routes there can be selected through Anthropic-compatible env
  (`ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`) derived from provider profiles
  such as `mimo-tp-anthropic`, `kimi-anthropic`, or `mimo-mify-anthropic`.
- OpenAI Agents SDK routes include chat-style profiles such as
  `mimo-inside-openai-chat` and `kimi-openai-chat`; these are not automatically
  safe to treat as Codex CLI candidates without a smoke proof.
- `.env` contains secret values and must never be copied into plans, logs, run
  summaries, or candidate manifests. The reusable shape is key names and
  provider-profile metadata, not secret values.

## Recommended Shape

Add a new repo-owned skill:

```text
skills/plan-bakeoff/
  SKILL.md
  scripts/
    run_plan_bakeoff.sh
    run_plan_bakeoff.ts
```

Use Bash for the entrypoint and Bun TypeScript for structured orchestration, in
line with this repo's agent guidance. The TypeScript runner can invoke the
existing Python `skill-runner` script; it should not add Python project
dependencies.

The skill should trigger when the user asks to:

- run one approved plan through multiple models or harnesses;
- do best-of-N implementation attempts;
- compare Codex Fast vs Codex strong vs Claude/Kimi/MiMo/MiniMax routes;
- create multiple worktrees for independent plan execution;
- use a fast model for implementation and a stronger model for judging.

## Execution Model

1. Validate input.
   - Require a plan path or inline approved plan.
   - Require target repo path.
   - Require explicit candidate set or a named local preset.
   - Require verification commands or a plan section that names them.

2. Establish baseline.
   - Record target repo root, branch, HEAD commit, and `git status --short`.
   - Default: block on dirty target repo.
   - Optional explicit mode: create a baseline patch from dirty changes and
     apply it to every candidate worktree before launch.

3. Create run directory.
   - Default: `~/.cache/plan-bakeoff/runs/<timestamp>-<repo>-<plan-slug>/`.
   - Store manifest, copied plan text, candidate metadata, logs, scorecards,
     and final report.
   - Store worktrees outside the target repo by default, under the run dir or
     `~/.cache/plan-bakeoff/worktrees/...`.

4. Create candidate worktrees.
   - One branch/worktree per candidate, all from the same base commit.
   - Branch names include run slug and candidate id.
   - Candidate worktrees never read each other's diffs during implementation.

5. Prepare candidate agent home.
   - Default: per-candidate ephemeral home under the bakeoff run dir.
   - Never write `~/.codex/config.toml`, `~/.claude/settings.json`,
     `~/.claude.json`, or existing global skill installs.
   - Copy or mount only the required skills into the ephemeral home.
   - Use CLI flags and env vars for provider/model selection rather than
     editing persistent config.

6. Launch one `skill-runner` per candidate.
   - Use `--cwd <candidate-worktree>`.
   - Use a candidate-specific `--run-root`.
   - Use `--agent-command` or a future public equivalent for custom harnesses.
   - Require the same rewritten task contract for every candidate.

7. Verify candidates.
   - Each worker must run its plan-required checks.
   - The bakeoff runner may also run a shared post-check command in every
     candidate worktree after worker completion.
   - All checks are captured into candidate scorecards.

8. Judge.
   - Main session or a judge worker reads only final artifacts, diffs, and
     verification output.
   - Judge prompt is read-only by default.
   - Judge uses the original plan acceptance criteria as the rubric.
   - Judge can recommend a winner, rejection, cherry-pick ideas, or a repair
     phase.

9. Handoff.
   - Do not auto-merge by default.
   - Recommend a winner worktree and a port command through
     `$intuitive-port-worktree`.
   - Keep rejected candidate worktrees until the user or cleanup command removes
     them.

## Candidate Manifest

Use a JSON manifest that names routes and env keys, not secret values. YAML is
intentionally parked for v0. Real `codex-cli` and `claude-code` command
rendering exists, but execution stays behind the explicit `--execute-real` gate.

Example v0 manifest:

```json
{
  "schema": "plan_bakeoff_manifest_v1",
  "target_repo": "/path/to/repo",
  "plan": "docs/plans/example.md",
  "base": { "mode": "clean-head", "ref": "HEAD" },
  "verification": {
    "commands": ["bun test", "bun run check"]
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

Candidate fields:

- `id`: stable run-local id.
- `harness`: `fake`, `codex-cli`, or `claude-code`. Real harnesses need
  explicit `--execute-real` approval for each run.
- `provider_profile`: route/profile name, not a secret.
- `model`: model id or route default.
- `env_file`: optional repo-local env file to source in memory.
- `required_env`: key names that must be present before launch.
- `command_profile`: deterministic fake profile for fake candidates.
- `runtime`: `host` by default; Docker is intentionally unsupported in v0.
- `skills`: selected skills to copy into the ephemeral candidate home.

## Provider And Harness Policy

Provider selection should be profile-first, not model-first.

Reasons:

- The same model id can behave differently across Responses, Chat Completions,
  Anthropic-compatible, or gateway transports.
- Tool-call and image transport health are route properties, not only model
  properties.
- Some fast routes are useful for text implementation but unsafe for tasks that
  require MCP/tool correctness.

First-class harnesses:

- `codex-cli`: use `codex exec` with `--cd`, `--json`,
  `--output-last-message`, `--sandbox workspace-write` or dangerous mode only
  when explicitly approved. Use `-c model=...` and `-c model_provider=...`
  overrides for custom routes.
- `claude-code`: use `claude -p --output-format stream-json` with env-derived
  `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, and `--model` when a profile
  selects an Anthropic-compatible route. Prefer ephemeral `HOME` and avoid
  writing settings.
- `openai-agents-sdk`: do not include in v0 unless the target repo provides a
  specific coding-agent command that reads the same plan prompt, writes a final
  `RESULT_STATUS`, and can edit the worktree safely.

Do not assume every Roboclaws profile is portable to every target repo. Reuse
the pattern, not the Roboclaws implementation, unless the target repo is
Roboclaws.

## Runtime Policy

Default runtime: host worktree with ephemeral agent home.

Reasoning:

- Most target repos already have host-local dependencies, caches, hooks, local
  services, and test commands.
- Docker adds mount, user, network, skill path, and local service complexity.
- Docker can hide failures that matter in the actual target repo workflow.

Docker runtime is intentionally not implemented or advertised in v0. If a
future workflow needs pinned CLI isolation, design it as a separate approved
extension rather than treating it as a parked follow-up.

## Config Isolation Rules

Hard rules:

- Never edit global Codex or Claude config files.
- Never copy `.env` into the plan-bakeoff artifact tree.
- Never write secret values into command manifests, generated scripts, logs, or
  summaries.
- Source env files only in process memory.
- Redact known secret env values and common API-key patterns from logs.
- Generated candidate command lines must reference env var names, not inline
  key values.
- Candidate homes are disposable and run-local.

Allowed state:

- run-local ephemeral homes;
- run-local copied skill directories;
- run-local worktrees and branches;
- run-local artifacts, scorecards, and logs.

## Scorecard

Each candidate gets a `scorecard.json` and `scorecard.md`:

```json
{
  "candidate_id": "fake-a",
  "base_ref": "<commit>",
  "status": "SUCCESS",
  "worker_status": "SUCCESS",
  "verification": [
    {"command": "bun test", "status": "pass"}
  ],
  "diff_stats": {
    "files_changed": 4,
    "insertions": 120,
    "deletions": 40
  },
  "route": {
    "harness": "fake",
    "provider_profile": "fake",
    "model": "fake"
  }
}
```

The final report ranks candidates by:

1. plan acceptance coverage;
2. verification success;
3. absence of unrelated edits;
4. simplicity and maintainability of diff;
5. consistency with repo architecture and docs;
6. useful ideas worth cherry-picking even if the candidate loses;
7. runtime duration and token/cost data when available.

Speed matters, but only after correctness and mergeability.

## Flow Execution Contract

Run this through `$intuitive-flow` as one durable implementation, not as
separate user-approved slices. Flow owns the full delivery from skill creation
through fake-worker verification and closeout.

Current state: reviewed draft plan with plan-entropy findings.

Latest user intent: execute through Flow after this plan is accepted.

Goal ownership: main session owns the root Flow goal; workers may own bounded
implementation/check sub-goals only.

Selected path: `$intuitive-flow` durable execution.

Execution surface: `skill-runner` or tmux worker for implementation, with the
main session supervising artifacts, diffs, tests, and final verification.

Stop gate: the full definition of done below, plus hard stops.

### Scope

Deliver all of the following in one Flow run:

- Create `skills/plan-bakeoff/SKILL.md`.
- Create `skills/plan-bakeoff/scripts/run_plan_bakeoff.sh`.
- Create `skills/plan-bakeoff/scripts/run_plan_bakeoff.ts`.
- Implement manifest parsing, dry-run planning, worktree creation, ephemeral
  agent home preparation, candidate launch through `skill-runner`, fake-worker
  verification, scorecard generation, and final report generation.
- Add focused tests for JSON manifest parsing, secret redaction, worktree/run
  layout, no-global-config-touch checks, gated real harnesses, scorecard
  generation, and fake-worker bakeoff.
- Update any relevant skill index/allowlist only if this repo requires it for
  repo-owned root skills.
- Update this plan status and closeout evidence after implementation.

### Non-Goals

- Do not run real provider/model calls by default.
- Do not add a Docker image to this repo.
- Do not import Roboclaws provider registry code.
- Do not auto-port or auto-merge a winning candidate.
- Do not change global Codex or Claude configuration.
- Do not make `plan-bakeoff` depend on Roboclaws paths.

### Internal Execution Order

Flow may choose worker boundaries, but it should complete the whole contract
without asking the user between these internal milestones unless a hard stop is
hit:

1. Build the skill shell and JSON manifest docs.
2. Implement dry-run manifest validation.
3. Add fake-worker candidate execution over multiple worktrees.
4. Add scorecards and final report generation.
5. Add tests and no-secret/no-global-config proof.
6. Run checks, update plan closeout, and summarize final status.

These are internal milestones, not separate approval slices.

### Definition Of Done

Flow can report full success only when:

- `plan-bakeoff` skill exists and describes when to use the workflow.
- The runner can perform a dry-run from a manifest without touching global
  config or printing secret values.
- The runner can execute at least three fake candidates in separate worktrees
  from the same base ref.
- Candidate artifacts include worker run dirs, scorecards, and a final ranking
  report.
- Tests cover fake env redaction and prove fake secret values are absent from
  generated artifacts.
- Tests or scripted proof show global config files are not modified.
- Relevant repo checks pass.
- This plan records final proof and any parked work.

### Required Proof

- `bun test` for the new runner tests.
- `bun run check`.
- `bun run check:skills` if the new skill is added to the repo-owned skill
  surface.
- A fake-worker bakeoff command that completes without network or real model
  calls.
- `git diff --check`.

### Hard Stops

Flow must stop for a user decision before:

- reading or printing real secret values;
- sourcing an env file outside process memory;
- running real provider/model candidates;
- adding Docker runtime support;
- modifying `~/.codex`, `~/.claude`, `~/.claude.json`, or another global agent
  config path;
- changing `skill-runner` behavior in a way that affects existing callers
  beyond a documented public `--agent-command`/candidate-command surface;
- auto-porting or merging any candidate output;
- adding a repo-wide provider registry or copying Roboclaws-specific code.

### Soft Continuations

Flow may choose these defaults without asking:

- Use `plan-bakeoff` as the skill name.
- Keep host runtime as default.
- Keep real provider execution behind explicit approval. Provider smoke can run
  manually after approval and should be recorded without secret values.
- Use fake workers for complete v0 proof.
- Add a public wrapper around the existing `skill-runner --agent-command` only
  if required for maintainable implementation.

## Plan Entropy Review

Selected mode: plan entropy mode.

Why: this is a draft plan for a new multi-worktree model/harness evaluation
skill, so the useful work is finding missing decisions, weak assumptions, proof
gaps, and routing mistakes before implementation.

Redirect: none.

Discovery intensity: selection scan.

### Candidate 1: Make route readiness a first-class gate

Demand gate: pass. A model-name-only bakeoff would create false confidence
because provider transport, tool-call behavior, image support, and CLI harness
health vary independently from the model id.

Severity: P1.

Entropy source: false confidence.

Materiality: without this gate, a candidate can lose because its route was
blocked, not because the model was weak.

Evidence:

- Roboclaws route verdicts distinguish `codex-cli`, `claude-code`, and
  `openai-agents-sdk` health for the same provider families.
- Roboclaws marks some routes healthy for one engine and blocked/degraded for
  another.

Owner: `plan-bakeoff` manifest validator.

Proof:

- Candidate validation fails when required env keys are missing.
- Candidate validation fails fast when a real harness is requested without
  `--execute-real`.

Risk: route health can become stale. The skill should allow explicit override
with a run-local note, not bake Roboclaws verdicts into this repo as universal
truth.

### Candidate 2: Separate provider profiles from secret env values

Demand gate: pass. The workflow must consume repo-local `.env` values without
printing, copying, or committing them.

Severity: P1.

Entropy source: security and workflow friction.

Materiality: a multi-agent runner creates many generated scripts and logs; one
inline token in a command would leak across artifacts.

Evidence:

- Roboclaws `.env.example` documents only key names.
- Roboclaws has a redaction helper for provider logs.
- User explicitly called out environment-variable-driven model/harness choice.

Owner: `plan-bakeoff` script.

Proof:

- Tests cover redaction of secret-shaped values and known secret env values.
- Generated fake-candidate artifacts and rendered real-harness commands avoid
  inline secret values.

Risk: shell tracing or child tools can still echo env. Disable `set -x` in
runner-generated scripts and redact captured logs.

### Candidate 3: Use ephemeral agent homes without losing required skills

Demand gate: pass. Isolating config prevents clobbering global Claude/Codex
state, but an empty home can also make selected skills unavailable.

Severity: P1.

Entropy source: live source drift and workflow friction.

Materiality: the candidate could fail for harness setup rather than
implementation quality, or it could mutate the user's normal agent config.

Evidence:

- Roboclaws Docker wrapper uses isolated HOME and an optional empty Codex skills
  mount for isolated tasks.
- Current `skill-runner` relies on installed skills being available in the
  worker environment.
- User specifically warned that existing Claude Code defaults should not be
  overwritten.

Owner: `plan-bakeoff` home preparation.

Proof:

- Dry-run shows the exact skill directories copied into each candidate home.
- Fake worker proves `$intuitive-flow` or another selected skill is discoverable
  from the ephemeral home.
- Before/after checksums or mtimes for global config files stay unchanged in
  tests.

Risk: Claude and Codex discover skills differently. The first implementation
should support Codex skill copying first and require an explicit Claude smoke
proof before enabling Claude candidates by default.

### Candidate 4: Keep Docker out of v0

Demand gate: pass. Docker can be useful for pinned CLIs and clean HOME, but
including it in v0 adds avoidable setup and target-repo dependency complexity.

Severity: P2.

Entropy source: implementation scope and runtime drift.

Materiality: a Docker-first bakeoff can fail on missing mounts, local services,
user IDs, and dependency caches before testing the model.

Evidence:

- Roboclaws has a repo-specific coding-agent Docker image and wrapper.
- This repo's target use case is cross-repo, so the runner cannot assume a
  Roboclaws-specific Dockerfile exists.

Owner: implementation plan.

Proof:

- Host runtime works in dry-run and fake-worker tests.
- Docker is rejected as unsupported until a separate approved extension designs
  pinned CLI isolation.

Risk: host Codex/Claude CLI versions can differ across machines. The report
should capture CLI versions for every candidate.

### Candidate 5: Define the merge boundary before implementation

Demand gate: pass. Best-of-N produces several diffs; without a merge boundary
the tool may accidentally become an auto-merge system.

Severity: P1.

Entropy source: scope leak.

Materiality: auto-porting a winner can silently discard better partial ideas or
merge a change the judge only ranked provisionally.

Evidence:

- `intuitive-port-worktree` already owns safe worktree-to-target transfer.
- `skill-runner` evaluation artifacts are advisory until the main session
  inspects the actual diff.

Owner: `plan-bakeoff` final report.

Proof:

- Default final report contains a recommended port command, not an automatic
  merge.
- Auto-port requires an explicit flag or follow-up user approval.

Risk: too much friction for low-risk tasks. Add a later explicit
`--auto-port-if-single-success` only after the manual flow proves stable.

### Candidate 6: Make judge output useful even when no candidate is clean

Demand gate: pass. In real project work the best output may be one candidate's
architecture plus another candidate's tests, not a single clean winner.

Severity: P2.

Entropy source: false winner pressure.

Materiality: ranking-only output can throw away useful implementation ideas.

Evidence:

- The user wants quick results more than token savings.
- Fast models may produce useful partial implementations even when strong
  models produce cleaner final diffs.

Owner: judge rubric.

Proof:

- Final report has separate fields for `winner`, `mergeable_with_fixes`,
  `cherry_pick_ideas`, and `reject`.

Risk: cherry-pick recommendations can become vague. Require file/path evidence
for each recommended idea.

## Entity Budget

Allowed new durable entities for v0:

- one new skill: `skills/plan-bakeoff`;
- one Bash entrypoint;
- one Bun TypeScript runner;
- one manifest reference;
- one run artifact schema.

Avoid in v0:

- repo-wide provider registry;
- baked-in Roboclaws model matrix;
- Docker image in this repo;
- automatic merge/port;
- live provider probes as normal validation tests.

## Open Decisions

1. Skill name: `plan-bakeoff` vs `best-of-n-runner`.
   Recommendation: `plan-bakeoff`, because the input is an approved plan and
   the output is an implementation bakeoff.

2. Default candidate preset.
   Recommendation: keep a small built-in proposal for the requested routes when
   their env keys are present, and let the manifest own any larger matrix.
   Requested Codex, Kimi, MiniMax, and MiMo routes now have smoke evidence; a
   target repo can still prune candidates before execution.

3. Claude Code default handling.
   Recommendation: never assume or rewrite the user's current Claude default.
   For Claude candidates, use env-derived Anthropic-compatible route settings
   inside an ephemeral HOME. Treat the user's "default Claude Code is MIMO 1000"
   as current local state, not target configuration.

4. Whether to reuse Roboclaws provider registry.
   Recommendation: reuse the pattern and maybe copy small command-rendering
   ideas later, but do not import Roboclaws code into this repo. The skill must
   work across target repos.

5. Whether to formalize `skill-runner --agent-command`.
   Recommendation: yes, but keep it as a low-level escape hatch. The bakeoff
   manifest should own friendly candidate profiles.

## Verification For This Plan

Planning/document-only verification:

- `git diff --check -- .planning/plan-bakeoff-skill.md`

Implementation verification:

- manifest parser tests with fake env;
- command-rendering tests that prove secrets are not in generated artifacts;
- fake-worker bakeoff that runs three candidates without network;
- global-config no-touch test for `~/.codex/config.toml`,
  `~/.claude/settings.json`, and `~/.claude.json`;
- dry-run against a tiny temp repo;
- real provider smoke only after explicit approval.

## Closeout

Implemented in one `$intuitive-flow` durable run.

What changed:

- Added `skills/plan-bakeoff` with a concise skill entrypoint, OpenAI skill UI
  metadata, Bash wrapper, Bun runner, and focused tests.
- Added `plan-bakeoff` to `scripts/default-skill-allowlist.txt` as a
  repo-owned direct utility.
- Refactored v0 after entropy review to stay JSON-only and fake-candidate-only.
  YAML parsing, placeholder judge/status fields, and the completed active
  capsule were removed.
- Added the minimal real-run gate after user review: `.plan-bakeoff.env`
  gitignore support, built-in proposal templates, `--execute-real`, and command
  rendering for `codex-cli` and `claude-code`.
- Added the smoke-proven Anthropic-compatible mappings for Claude Kimi,
  MiniMax, MiMo token-plan, and MiMo 1000 UltraSpeed. MiMo 1000 may identify as
  `mimo-v2.5-pro`; treat it as the 256k-context UltraSpeed route.
- Simplified after a real-task trial: Docker runtime is not advertised or
  accepted in v0, and candidate prompts now tell models to implement the plan
  directly instead of nesting `$intuitive-flow`/`skill-runner`.

Proof:

- `python3 /home/mi/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/plan-bakeoff`
- `bun test skills/plan-bakeoff/scripts/run_plan_bakeoff.test.ts`
- CLI dry-run against a temporary git repo.
- CLI fake-worker bakeoff against a temporary git repo with three candidates:
  `fake-a` SUCCESS, `fake-c` SUCCESS, `fake-b` PARTIAL; final report selected
  `winner: fake-a`.
- The CLI proof used temporary `HOME` and `CODEX_HOME` and verified no
  `.codex/config.toml` or `.claude/settings.json` was written.
- Provider smoke, after explicit user approval:
  - Codex `gpt-5.5`: PASS.
  - Codex `gpt-5.3-codex`: PASS.
  - Codex `MiniMax-M3` through `minimax-responses`: PASS.
  - Claude Code `MiniMax-M3` through Anthropic-compatible MiniMax route: PASS.
  - Claude Code `mimo-1000` through MiMo UltraSpeed route: PASS.
  - Direct MiniMax Anthropic-compatible API: PASS.
  - Direct MiMo 1000 Anthropic-compatible API: PASS; route may identify as
    `mimo-v2.5-pro`, which is acceptable for MiMo v2.5 Pro UltraSpeed with a
    256k context window.
  - Claude Code `kimi-k2.7-code`: PASS.
- Real-task trial:
  - Plan: remove Docker runtime surface from `plan-bakeoff`.
  - `codex-gpt-5.5` produced a useful 4-file diff and passed the focused
    `bun test skills/plan-bakeoff/scripts/run_plan_bakeoff.test.ts`.
  - The candidate scorecard was not a clean winner because the temporary repo
    lacked `tsc` for full `bun run verify`, and nested `$intuitive-flow`
    orchestration created unnecessary `skill-runner`/tmux recursion.
  - Adopted the useful simplification manually and changed future candidate
    prompts to avoid nested agent delegation.
- `bun run check:skills`
- `bun run check:shell`
- `bun run check`
- `bun test ./scripts ./skills`
- `bun run verify`
- `git diff --check`

Scope changes:

- Real provider/model harnesses require explicit `--execute-real`.
- Manifest parsing is JSON-only.
- Docker runtime is intentionally unsupported in v0.
- No global Codex or Claude config was modified.
- No candidate output was ported or merged.
- No Roboclaws code was imported.

Parked work:

- Full real project bakeoff with explicit approval.
- YAML manifest support, only if JSON becomes a real workflow problem.
- Docker runtime support, only if a future approved plan makes pinned CLI
  isolation part of the scope.
- Auto-port or auto-merge mode, if ever wanted, behind an explicit flag.
