# Intuitive Flow Audit Prompt

Last reviewed: 2026-05-22

This is the copy/paste prompt for a human-triggered review of
`skills/intuitive-flow` against current official agent tooling and community
skill practice.

Scope boundaries:

- Use this file when starting a fresh Codex or Claude Code session to research
  external skills, best practices, and built-in capabilities.
- Use `skill-self-improvement-audit.md` as the dated baseline audit of
  repo-owned skills. Do not use it as the recurring prompt.
- Use `agent-harness-references.md` as the durable source ledger when an
  external lesson is accepted.

## Prompt

```text
Research whether `skills/intuitive-flow` should change based on current
official Claude Code/Codex capabilities and high-signal community coding-agent
skills or best practices.

Mode:
- Report only.
- Do not edit files.
- Do not change `skills/intuitive-flow/**` directly.
- Do not patch installed user-level skills, global agent tooling, vendored
  skills, or third-party repos.

Read local truth first:
- `README.md`
- `ARCHITECTURE.md`
- `STATUS.md`
- `docs/human/agent-harness-references.md`
- `docs/human/skill-self-improvement-audit.md`
- `skills/intuitive-flow/SKILL.md`
- relevant `skills/intuitive-flow/references/*.md` only if needed

Then research current external practice:
- official Claude Code docs/release notes for skills, hooks, plugins, MCP,
  subagents, memory, and planning/execution workflows
- official Codex docs/release notes for AGENTS.md, skills, MCP, subagents,
  plugins, planning, execution, and verification workflows
- high-star or widely cited community coding-agent skills, commands, hooks,
  plugins, workflow repos, and writeups with reproducible practices

Compare external findings against the current `intuitive-flow` contract:
- compact runtime router in `SKILL.md`
- conditional detail in `references/` and `templates/`
- one source of truth per stage: `docs/plans/`, `.planning/`, then
  verification/closeout artifacts
- plan entropy, optional `gstack-autoplan` unknown-unknown scouting, grill-batch,
  preflight, GSD handoff, `simplify`, verification, semantic commits, and
  parked-todo closeout routed at the correct stage
- deterministic checks in scripts/tests/hooks when they are better than prompt
  text

Return a concise report:

1. Verdict:
   - keep as-is
   - update human docs/source ledger
   - update agent runbook/prompt
   - add deterministic validation
   - run A/B test
   - later update runtime skill
2. Source table:
   - link
   - official or community
   - access date
   - distilled lesson
   - quality signal, such as official status, stars/adoption, benchmark, or
     concrete field evidence
3. Findings:
   - P0: current flow is broken or corrupts source of truth
   - P1: likely quality regression versus available official or proven practice
   - P2: bounded maintenance improvement
   - Parked: interesting but not actionable yet
4. A/B candidates:
   - candidate source
   - exact behavior to test
   - current `intuitive-flow` baseline
   - fixture repo or task shape
   - success metrics
   - adoption threshold
5. Recommended landing place:
   - `docs/human/agent-harness-references.md`
   - this prompt or another human doc
   - `docs/agents/**`
   - `skills/intuitive-flow/**`
   - scripts/tests/hooks
   - no action / parked

Be conservative. High stars are not enough. Recommend runtime skill changes only
when a source gives a concrete execution-quality improvement that belongs in the
agent's normal `$intuitive-flow` path.
```

## Local Verification

After changing this prompt or linked skill-maintenance docs, run:

```bash
bun run check:skills
bun run verify
```
