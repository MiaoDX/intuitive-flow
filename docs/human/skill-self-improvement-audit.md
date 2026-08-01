# Skill Self-Improvement Audit

Last reviewed: 2026-08-01

This audit applies the self-improvement lens from
[`agent-harness-references.md`](agent-harness-references.md) to the managed
skill portfolio listed in `scripts/default-skill-allowlist.txt`. The
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

- `scripts/default-skill-allowlist.txt` now parses default, routed, and
  on-demand tiers plus external host scope. Comments describe groups but no
  longer carry install semantics.
- Retired local artifacts are kept out of the install allowlist and listed in
  `scripts/default-skill-prune-ledger.txt` for updater-owned cleanup.
- `$diagnose` is no longer installed by default. `$gstack-investigate` is the
  default root-cause/debugging entrypoint because the GStack skill set already
  owns browser-visible investigation and QA workflows.
- GSD phase machinery (`gsd-new-project`, `gsd-import`, `gsd-plan-phase`,
  `gsd-execute-phase`, and `gsd-verify-work`) is no longer default-visible.
  `$intuitive-flow` remains the route that names those commands when a committed
  GSD phase is actually needed.
- Keep `$grill-with-docs-batch` routed for convergence; the external
  single-question `$grill-with-docs` remains registered on-demand.
- Keep `$codebase-design` routed as the shared architecture vocabulary and
  `$improve-codebase-architecture` routed as an optional report-only deepening
  scanner when the first review still leaves no accepted target seam. Keep its
  `$grilling` and `$domain-modeling` runtime dependencies routed with it.
- Keep `$gstack-autoplan` routed as a risk-triggered planning scout, not a
  mandatory plan-backed execution gate.
- Keep Anthropic `skill-creator` and the Claude-oriented external `codex`
  wrapper on-demand and Claude-only so they do not collide with Codex built-ins
  or appear inside Codex by default.
- Keep only `ponytail-audit` and `ponytail-review` routed. The broad mode, help,
  and debt ledger remain on-demand.
- Multi-mode skills should expose a compact `Modes` table and state selected
  mode only when it affects execution. Use `Mode note` sparingly for manual
  invocation, ambiguity, or better-route discovery; do not add mode menus to
  single-purpose utility skills.
- Keep the STE-flavored plan prose adapter internal to Flow during its shadow
  trial. It is a form checker after plan reconciliation, not a new public skill
  or a substitute for plan entropy, engineering review, or preflight.

## Skill Adoption Ladder

Use this sequence before a new skill becomes normal runtime behavior:

1. **Source audit:** review license, provenance, side effects, host assumptions,
   context size, update behavior, and overlap with current owners.
2. **Interface contract:** name the single seam, input, output, mutation scope,
   failure behavior, stop gate, and existing owner that invokes it. Prefer an
   internal adapter when only one workflow needs the behavior.
3. **Fixture A/B:** compare representative historical tasks. Treat semantic
   correctness, literal preservation, and contract completeness as hard gates;
   use style scores, preference, latency, and token cost as supporting evidence.
4. **Routed shadow:** install or bundle the candidate so its owner cannot forget
   it, but report without mutation. Persist summary-only local trial events,
   deduplicate repeated snapshots, and collect explicit useful/mixed/noise
   reviews outside canonical artifacts.
5. **Guarded rollout:** allow narrowly scoped mutation only after shadow data is
   useful. Run structural checks and inspect the semantic diff before applying
   a candidate.
6. **Promotion or removal:** promote only with stable benefit, acceptable cost,
   and a rollback path. Otherwise keep the behavior advisory, return it to
   on-demand use, or remove it.

`default`, `routed`, and `on-demand` control installation and discovery, not
automatic execution. Prefer `routed` for a specialist that an existing owner
must invoke. Reserve `default` for a small public entry surface.

### Plan Prose Weekly Review

The Flow plan prose trial writes summary-only events to
`${XDG_STATE_HOME:-~/.local/state}/intuitive-flow/plan-prose-gate.jsonl`. It
stores local paths and metrics so maintainers can reopen samples, but no plan
prose or finding excerpts. The state stays local and uses private permissions.

Run the installed helper after seven days:

```bash
bun <intuitive-flow-skill-root>/scripts/plan-prose-gate.ts --report --since 7d
```

Use each sample event id to record an evidence label after inspecting the plan
and detailed findings:

```bash
bun <intuitive-flow-skill-root>/scripts/plan-prose-gate.ts \
  --review <event-id> <useful|mixed|noise> [short-note]
```

Five unique reviewed snapshots are the minimum decision packet. At least 50%
`noise` recommends drop or retune. At least 60% `useful` recommends candidate
shadow, not automatic rewrite. Other results stay in shadow until the signal is
clear. The helper reports this recommendation but never changes the rollout
mode itself.

## Repo-Owned Root Skills

| Skill | WHY Clarity | WHAT Boundary | HOW / Stop Condition | Recommendation |
| --- | --- | --- | --- | --- |
| `grill-with-docs-batch` | Strong: improves decision quality before implementation. | Strong: owns batched plan/domain grilling and stops when docs already answer the durable questions. | Strong: decision-impact test and convergence rules are explicit. | Keep as a specialist discussion skill; no runtime self-improvement block. |
| `intuitive-doc` | Strong: keep human docs current and small. | Strong: owns human-facing docs and boundary drift, skips agent files by default. | Strong: audit/update/guard modes and claim verification are clear. | No runtime self-improvement block. Later slim examples if the doc keeps growing. |
| `agent-planning-loop` | Strong: moves contested planning critique into bounded agent scouts before user review. | Strong: owns read-only planning debate and synthesis, not implementation or self-approval. | Strong: charter, scout prompts, materiality filtering, stop gates, and review-packet output are explicit. | Primary planning entrypoint for "align yourselves" and planning-loop style requests; no runtime self-improvement block. |
| `intuitive-flow` | Strong: routes approved plans and execution contracts to verified work. | Strong: owns staging and handoffs through a compact entrypoint plus route-specific references. | Strong: checkpoints and routing are explicit without loading a parallel runtime manual. | Keep as the execution router. |
| `intuitive-init` | Strong after harness refresh: builds repo-local agent harness and trims high-frequency startup context. | Strong: owns `AGENTS.md`, `CLAUDE.md`, `docs/agents/**`, first-read policy, orientation-doc hygiene, init discovery, hooks, skills, and MCP routing. | Strong: startup cleanup mode, modes, and stop conditions are explicit. | Specialist skill; route from reduce-entropy when agent guidance or first-read context is the issue. |
| `intuitive-port-worktree` | Strong: move worktree changes without switching the target branch. | Strong: owns porting/cherry-pick/patch transfer only. | Strong: source/target discovery, payload selection, and safety gates are explicit. | Keep as a specialist handoff utility; no meta text needed. |
| `intuitive-preflight` | Strong: make vague execution intent approval-ready before implementation. | Strong: owns context package, scope, non-goals, acceptance, verification, route, and goal wording. | Strong: draft contract and approval boundary are explicit. | Specialist skill; route from flow or direct use before vague execution. |
| `intuitive-reduce-entropy` | Strong: explicit repo entropy mode for maintenance and plan entropy mode for idea/plan blind spots. | Strong: owns entropy diagnosis and routes to doc/init/tests/refactor or grill-batch/preflight instead of forcing the user to choose first. | Strong: mode declaration, candidate list, gate, route, verify, and park. | Primary entropy entrypoint. |
| `intuitive-refactor` | Strong: bound aggressive cleanup plus changed-code review. | Strong: owns scope gates, severities, evidence, parked ideas, ratchet mode, and diff-scoped reuse/quality/efficiency review. | Strong: persistent gate, ladder, and changed-code review scope are clear. | Absorbed the former `simplify` workflow; keep as the cleanup/refactor owner. |
| `intuitive-squash` | Strong: rewrite noisy agent history safely. | Strong: owns commit grouping and safety protocol only. | Strong: explicit confirmation and verify commands. | Keep registered on-demand. |
| `intuitive-tests` | Strong: improve test suite signal. | Strong: owns test taxonomy, pruning, fixture/layout cleanup. | Strong but long: many examples are useful runtime guidance. | Specialist skill; route from reduce-entropy when tests are the issue. |
| `multica-goal-tracker` | Strong: keeps goal-driven Multica issues tied to execution proof. | Strong: owns issue goal summaries, tracked start/finish comments, and text completion evidence only. | Strong after tracker harness: defaults fail fast without real session history, and parsing/comment behavior is covered by skill-local tests. | Specialist issue-workflow utility; not part of the small public planning/build surface. |
| `plan-bakeoff` | Strong: compares candidate implementations for an approved plan. | Strong: owns best-of-N plan execution, scorecards, and final ranking, not ordinary flow execution. | Strong: manifest gates, skill-runner ownership, secret redaction, and fake/real harness proof are explicit. | On-demand utility; compact entrypoint delegates options/schema to CLI help. |
| `research` | Strong: produces decision-useful answers from traceable evidence. | Strong: owns research framing, source acquisition, claim provenance, contradiction handling, and synthesis while reusing existing retrieval/delegation tools. | Strong: proportional depth, claim-level ledger, one gap pass, honest confidence, and explicit access/time/source stops. | Keep on-demand; evaluate on real technical, ecosystem, and Chinese-source tasks before considering a routed role. |
| `skill-runner` | Strong: supervise real skill-driven development runs. | Strong: owns runner orchestration and reusable-skill defect detection. | Strong: verdicts, policy, and stop conditions are explicit. | Routed execution backend; compact entrypoint delegates options to CLI help. |

## External And Managed Portfolio

| Surface | Default role | Recommendation |
| --- | --- | --- |
| `skill-creator` | External authoring utility from Anthropic's skills source. | Claude-only and on-demand; Codex keeps its built-in owner. |
| `codex` | Claude-oriented external utility for Codex CLI workflows. | Claude-only and on-demand; never install into Codex by default. |
| `grill-with-docs`, `handoff`, `tdd` | Narrow external specialists. | Registered on-demand; local/routed owners remain the normal workflow surface. |
| `codebase-design`, `improve-codebase-architecture`, `grilling`, `domain-modeling` | Architecture vocabulary, optional report-only deepening, and its runtime dependencies. | Keep routed so Reduce Entropy, Refactor, and Flow can run the architecture review sequence without a separate install step. |
| `ponytail-audit`, `ponytail-review` | Simplicity and over-engineering review inputs used by local routes. | Keep routed. |
| `ponytail`, `ponytail-debt`, `ponytail-help` | Broad/trial/help utilities. | Keep on-demand; do not occupy default discovery. |
| `gstack-browse`, `gstack-open-gstack-browser` | Browser launch and browser QA helpers. | Keep browse default; open-browser is on-demand. |
| `gstack-autoplan`, `gstack-plan-eng-review`, `gstack-review`, `gstack-qa` | Managed review and QA wrappers. | Keep planning/review routes installed; QA is on-demand until usage justifies promotion. |
| `gstack-investigate` | Managed root-cause investigation workflow. | Keep as the default debugging/investigation route; do not also default-install `$diagnose`. |
| `gsd-progress`, `gsd-resume-work`, `gsd-pause-work` | GSD status and continuation helpers. | Registered on-demand; Flow can name them when a GSD run exists. |

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
  is a router, and `references/detailed-guidance.md` is an index.
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
