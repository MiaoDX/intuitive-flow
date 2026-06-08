# Skill Self-Improvement Audit

Last reviewed: 2026-06-08

This audit applies the self-improvement lens from
[`agent-harness-references.md`](agent-harness-references.md) to every current
repo-owned root skill listed in `scripts/local-skill-manifest.txt`. The goal is
not to paste a maintenance prompt into every skill. The goal is to find which
skill texts should become smaller, clearer, or better routed across docs,
scripts, hooks, tests, and skills.

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
- Use this audit as the baseline for later skill-specific cleanup.

## Audit Table

| Skill | WHY Clarity | WHAT Boundary | HOW / Stop Condition | Recommendation |
| --- | --- | --- | --- | --- |
| `grill-with-docs-batch` | Strong: improves decision quality before implementation. | Strong: owns batched plan/domain grilling and stops when docs already answer the durable questions. | Strong: decision-impact test and convergence rules are explicit. | Keep as a specialist discussion skill; no runtime self-improvement block. |
| `intuitive-doc` | Strong: keep human docs current and small. | Strong: owns human-facing docs and boundary drift, skips agent files by default. | Strong: audit/update/guard modes and claim verification are clear. | No runtime self-improvement block. Later slim examples if the doc keeps growing. |
| `intuitive-flow` | Strong but broad: routes fuzzy ideas to verified work. | Medium: owns staging and handoffs, but the file is long because it encodes many downstream gates. | Strong: checkpoints and routing are explicit. | Candidate for future extraction into smaller references or subflow docs, but do not add meta text. |
| `intuitive-init` | Strong after harness refresh: builds repo-local agent harness. | Strong: owns `AGENTS.md`, `CLAUDE.md`, `docs/agents/**`, init discovery, hooks, skills, and MCP routing. | Strong: modes and stop conditions are explicit. | Specialist skill; route from reduce-entropy when agent guidance is the issue. |
| `intuitive-planning-loop` | Strong: moves contested planning critique into bounded agent scouts before user review. | Strong: owns read-only planning debate and synthesis, not implementation or self-approval. | Strong: charter, scout prompts, materiality filtering, stop gates, and review-packet output are explicit. | Primary planning entrypoint for "align yourselves" style requests; no runtime self-improvement block. |
| `intuitive-port-worktree` | Strong: move worktree changes without switching the target branch. | Strong: owns porting/cherry-pick/patch transfer only. | Strong: source/target discovery, payload selection, and safety gates are explicit. | Keep as a specialist handoff utility; no meta text needed. |
| `intuitive-preflight` | Strong: make vague execution intent approval-ready before implementation. | Strong: owns context package, scope, non-goals, acceptance, verification, route, and goal wording. | Strong: draft contract and approval boundary are explicit. | Specialist skill; route from flow or direct use before vague execution. |
| `intuitive-reduce-entropy` | Strong: periodic repo maintenance when the user does not know the target. | Strong: owns entropy diagnosis and routes to doc/init/tests/refactor instead of forcing the user to choose first. | Strong: candidate list, gate, route, verify, and park. | Primary maintenance entrypoint. |
| `intuitive-refactor` | Strong: bound aggressive cleanup. | Strong: owns scope gates, severities, evidence, parked ideas. | Strong: persistent gate and ladder are clear. | No immediate change. |
| `intuitive-squash` | Strong: rewrite noisy agent history safely. | Strong: owns commit grouping and safety protocol only. | Strong: explicit confirmation and verify commands. | No immediate change. |
| `intuitive-tests` | Strong: improve test suite signal. | Strong: owns test taxonomy, pruning, fixture/layout cleanup. | Strong but long: many examples are useful runtime guidance. | Specialist skill; route from reduce-entropy when tests are the issue. |
| `simplify` | Strong: review changed code for reuse, quality, efficiency. | Medium: owns diff-scoped review; adapter block is large and mechanical. | Medium: process is clear, but the codex adapter and reviewer prompts dominate the file. | Do not add meta text. Future candidate: move adapter/mechanics to shared adapter docs or generator if more skills use it. |
| `skill-runner` | Strong: supervise real skill-driven development runs. | Strong: owns runner orchestration and reusable-skill defect detection. | Strong: verdicts, policy, and stop conditions are explicit. | Already has skill-change policy. Do not add another meta block. |

## What The Lens Changes

- It makes `docs/human/agent-harness-references.md` the durable place for
  external lessons and skill-maintenance doctrine.
- It argues against adding self-maintenance sections to runtime skill text.
- It exposed `intuitive-layout` as a boundary-smell after user review; layout is
  now treated as a symptom routed by object instead of a root skill.
- It exposes two remaining future cleanup candidates: `intuitive-flow` because
  it is necessarily broad, and `simplify` because its adapter/mechanics are large.
- It does not justify broad rewrites today. Most skills already have clear
  execution contracts and stop conditions.

## Parked Follow-Ups

- Add a lightweight manifest check later if the repo wants to enforce that each
  root skill has a clear WHY / WHAT / HOW shape without requiring a literal
  section heading.
- Evaluate whether `simplify`'s Codex adapter block should be generated or
  moved to a shared reference if more adapted skills appear.
- Consider splitting long `intuitive-flow` reference material only after a real
  task shows that its size hurts execution quality.
