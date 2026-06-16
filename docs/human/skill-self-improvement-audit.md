# Skill Self-Improvement Audit

Last reviewed: 2026-06-16

This audit applies the self-improvement lens from
[`agent-harness-references.md`](agent-harness-references.md) to the default
installed skill surface listed in `scripts/default-skill-allowlist.txt`. The
goal is not to paste a maintenance prompt into every skill. The goal is to find
which visible skills should be primary, routed, direct utilities, external
fallbacks, or pruned from defaults.

Scope: this is a dated baseline audit result, not the recurring research
prompt. For a fresh Codex or Claude Code session that should compare
`skills/intuitive-flow` with current official and community practice, use
[`intuitive-flow-audit-prompt.md`](intuitive-flow-audit-prompt.md).

## Result

The lens mostly changes where maintenance knowledge lives. It should not become
always-loaded runtime text inside task skills.

Completed baseline correction:

- Runtime `Skill Self-Improvement Rule` blocks are absent from repo-owned
  skills.
- Keep the WHY / WHAT / HOW lens in human docs.
- Use this audit as the baseline for default-surface cleanup.

Current default-surface correction:

- `scripts/default-skill-allowlist.txt` now names tiers with comments:
  primary public choices, routed specialists, direct utilities, external
  specialists, managed GStack tooling, and GSD status/resume helpers.
- Retired local artifacts are kept out of the install allowlist and listed in
  `scripts/default-skill-prune-ledger.txt` for updater-owned cleanup.
- `$diagnose` is no longer installed by default. `$gstack-investigate` is the
  default root-cause/debugging entrypoint because the GStack skill set already
  owns browser-visible investigation and QA workflows.
- GSD phase machinery (`gsd-new-project`, `gsd-import`, `gsd-plan-phase`,
  `gsd-execute-phase`, and `gsd-verify-work`) is no longer default-visible.
  `$intuitive-flow` remains the route that names those commands when a committed
  GSD phase is actually needed.
- Keep `$grill-with-docs` default-visible as the one-question interactive
  fallback for domain-language and ADR conversations. `$grill-with-docs-batch`
  remains the preferred routed convergence path, but the upstream single-question
  skill is not a stale duplicate.
- Keep `$improve-codebase-architecture` default-visible as the optional
  report-only deepening scanner after the architecture review route. It is not
  a removal candidate unless a future audit shows the route no longer needs a
  visual/deepening architecture report.
- Keep `$gstack-autoplan` default-visible because the staged workflow names it
  as the optional unknown-unknown scout before grill-batch/preflight/execution.
- Multi-mode skills should expose a compact `Modes` table and state selected
  mode only when it affects execution. Use `Mode note` sparingly for manual
  invocation, ambiguity, or better-route discovery; do not add mode menus to
  single-purpose utility skills.

## Repo-Owned Root Skills

| Skill | WHY Clarity | WHAT Boundary | HOW / Stop Condition | Recommendation |
| --- | --- | --- | --- | --- |
| `grill-with-docs-batch` | Strong: improves decision quality before implementation. | Strong: owns batched plan/domain grilling and stops when docs already answer the durable questions. | Strong: decision-impact test and convergence rules are explicit. | Keep as a specialist discussion skill; no runtime self-improvement block. |
| `intuitive-doc` | Strong: keep human docs current and small. | Strong: owns human-facing docs and boundary drift, skips agent files by default. | Strong: audit/update/guard modes and claim verification are clear. | No runtime self-improvement block. Later slim examples if the doc keeps growing. |
| `agent-planning-loop` | Strong: moves contested planning critique into bounded agent scouts before user review. | Strong: owns read-only planning debate and synthesis, not implementation or self-approval. | Strong: charter, scout prompts, materiality filtering, stop gates, and review-packet output are explicit. | Primary planning entrypoint for "align yourselves" and planning-loop style requests; no runtime self-improvement block. |
| `intuitive-flow` | Strong: routes approved plans and execution contracts to verified work. | Strong: owns staging and handoffs through a compact entrypoint plus route-specific references. | Strong: checkpoints and routing are explicit without loading the legacy full manual by default. | Keep as the execution router; only read `legacy-runtime-detail.md` when diagnosing a split-reference regression. |
| `intuitive-init` | Strong after harness refresh: builds repo-local agent harness. | Strong: owns `AGENTS.md`, `CLAUDE.md`, `docs/agents/**`, init discovery, hooks, skills, and MCP routing. | Strong: modes and stop conditions are explicit. | Specialist skill; route from reduce-entropy when agent guidance is the issue. |
| `intuitive-port-worktree` | Strong: move worktree changes without switching the target branch. | Strong: owns porting/cherry-pick/patch transfer only. | Strong: source/target discovery, payload selection, and safety gates are explicit. | Keep as a specialist handoff utility; no meta text needed. |
| `intuitive-preflight` | Strong: make vague execution intent approval-ready before implementation. | Strong: owns context package, scope, non-goals, acceptance, verification, route, and goal wording. | Strong: draft contract and approval boundary are explicit. | Specialist skill; route from flow or direct use before vague execution. |
| `intuitive-reduce-entropy` | Strong: explicit repo entropy mode for maintenance and plan entropy mode for idea/plan blind spots. | Strong: owns entropy diagnosis and routes to doc/init/tests/refactor or grill-batch/preflight instead of forcing the user to choose first. | Strong: mode declaration, candidate list, gate, route, verify, and park. | Primary entropy entrypoint. |
| `intuitive-refactor` | Strong: bound aggressive cleanup plus changed-code review. | Strong: owns scope gates, severities, evidence, parked ideas, ratchet mode, and diff-scoped reuse/quality/efficiency review. | Strong: persistent gate, ladder, and changed-code review scope are clear. | Absorbed the former `simplify` workflow; keep as the cleanup/refactor owner. |
| `intuitive-squash` | Strong: rewrite noisy agent history safely. | Strong: owns commit grouping and safety protocol only. | Strong: explicit confirmation and verify commands. | No immediate change. |
| `intuitive-tests` | Strong: improve test suite signal. | Strong: owns test taxonomy, pruning, fixture/layout cleanup. | Strong but long: many examples are useful runtime guidance. | Specialist skill; route from reduce-entropy when tests are the issue. |
| `multica-goal-tracker` | Strong: keeps goal-driven Multica issues tied to execution proof. | Strong: owns issue goal summaries, tracked start/finish comments, and rendered completion evidence only. | Strong after tracker harness: defaults fail fast without real session history, and pure parsing/rendering behavior is covered by skill-local tests. | Specialist issue-workflow utility; not part of the small public planning/build surface. |
| `skill-runner` | Strong: supervise real skill-driven development runs. | Strong: owns runner orchestration and reusable-skill defect detection. | Strong: verdicts, policy, and stop conditions are explicit. | Already has skill-change policy. Do not add another meta block. |

## External And Managed Defaults

| Surface | Default role | Recommendation |
| --- | --- | --- |
| `skill-creator` | External authoring utility from Anthropic's skills source. | Keep default-visible for skill creation and maintenance tasks. |
| `codex` | External utility for Codex CLI workflows. | Keep default-visible because this repo supports Codex as a first-class host. |
| `grill-with-docs` | External one-question-at-a-time discussion specialist. | Keep default-visible as the interactive fallback for domain-language and ADR sharpening; do not re-suggest removal merely because batch is preferred for grouped convergence. |
| `handoff` | External context handoff utility. | Keep as direct utility for compacting long agent sessions. |
| `improve-codebase-architecture` | External report-only architecture discovery. | Keep default-visible behind reduce-entropy or architecture review for visual/deepening candidate reports; do not re-suggest removal without evidence that this report-only scanner is no longer used. |
| `tdd` | External test-first workflow. | Keep as direct specialist when the user explicitly wants TDD. |
| `zoom-out` | External architecture/context map. | Keep routed as the first architecture review pass before plan-eng-review. |
| `gstack-browse`, `gstack-open-gstack-browser` | Browser launch and browser QA helpers. | Keep for visual/runtime dogfooding that text checks miss. |
| `gstack-autoplan`, `gstack-plan-eng-review`, `gstack-review`, `gstack-qa` | Managed review and QA wrappers. | Keep default-visible for unknown-unknown plan scouting, plan review, PR review, and app QA gates. |
| `gstack-investigate` | Managed root-cause investigation workflow. | Keep as the default debugging/investigation route; do not also default-install `$diagnose`. |
| `gsd-progress`, `gsd-resume-work`, `gsd-pause-work` | GSD status and continuation helpers. | Keep as low-risk recovery/status commands. |

Removed from the default surface:

- `simplify`: folded into `$intuitive-refactor` changed-code review so Flow can
  trigger cleanup through the refactor owner instead of a separate diff-review
  skill.
- `diagnose`: overlapped with `gstack-investigate` for bug/root-cause reports.
  Re-add only if a future audit shows the GStack route is unavailable or too
  heavy for common debugging tasks.
- `gsd-new-project`, `gsd-import`, `gsd-plan-phase`, `gsd-execute-phase`, and
  `gsd-verify-work`: useful phase machinery, but too broad for the default
  visible surface. `$intuitive-flow` and GSD docs should name them only when a
  committed phase exists or a plan explicitly enters GSD.

## What The Lens Changes

- It makes `docs/human/agent-harness-references.md` the durable place for
  external lessons and skill-maintenance doctrine.
- It argues against adding self-maintenance sections to runtime skill text.
- It keeps the installed default surface tiered: primary choices stay small,
  specialists remain routed, and phase machinery is hidden until the workflow
  actually needs it.
- It exposed `intuitive-layout` as a boundary-smell after user review; layout is
  now treated as a symptom routed by object instead of a root skill.
- It moved `intuitive-flow` away from a parallel runtime manual: the entrypoint
  is a router, `references/detailed-guidance.md` is an index, and the historical
  full detail is parked as `legacy-runtime-detail.md` for regression diagnosis.
- It split the largest reduce-entropy detailed guidance into purpose-specific
  references so agents can load discovery, materiality, ranking/routing, or
  handoff detail independently.
- It does not justify broad rewrites today. Most retained defaults already have
  clear execution contracts and stop conditions.

## Parked Follow-Ups

- Add a lightweight manifest check later if the repo wants to enforce that each
  root skill has a clear WHY / WHAT / HOW shape without requiring a literal
  section heading.
- Consider splitting other long `detailed-guidance.md` files only after a real
  task shows that their size hurts execution quality.
