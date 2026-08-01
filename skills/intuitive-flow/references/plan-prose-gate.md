# Plan Prose Gate

Use this reference after the canonical plan contains all accepted planning
decisions and before `$intuitive-preflight` or the plan-backed execution gate
consumes it.

## Interface

The gate checks the form of plan prose without owning plan substance.

```text
input: one canonical plan
output: checked | rewritten | skipped, findings, deterministic-lint status,
        and protected-contract status
```

The plan author remains the only writer. The gate does not own scope,
architecture, acceptance criteria, verification, approval, or execution. It
must not add a second plan artifact or append review logs to the canonical plan.

## Current Rollout: Shadow

Run the gate for every new or materially revised `docs/plans/<slug>.md` after
the last content-changing planning stage. A plan-only request runs it before
the plan checkpoint. A plan that changes after the check runs it again.

Shadow mode is report-only:

1. Inspect ordinary prose with the STE-flavored rules below.
2. Resolve the helper relative to the loaded `intuitive-flow/SKILL.md`. Run it
   when Bun and the installed helper are available. In this source repo, use:

   ```bash
   bun skills/intuitive-flow/scripts/plan-prose-gate.ts docs/plans/<slug>.md
   ```

3. Do not rewrite the canonical plan.
4. Report one compact result outside the plan:

   ```text
   Plan prose gate: checked (shadow); findings=<count>; score=<per-100-words | unavailable>; rewrite=not-run.
   ```

The helper is evidence, not a portability requirement. If Bun or the helper is
unavailable in a target repo, complete the inline inspection and report
`score=unavailable`. Do not block planning or add Bun to the target repo.

## STE-Flavored Adapter

Apply these rules to ordinary plan prose:

- Use one name for one thing.
- Prefer short common words and direct verbs.
- Use active voice when the actor is known.
- Remove filler, marketing claims, and empty transitions.
- Keep one main action or claim in each sentence when that improves clarity.
- Split dense paragraphs, but keep enough context to preserve technical
  meaning.

Sentence length is an advisory signal, not a hard plan gate. Technical
conditions sometimes need more than 25 words. Do not trade precision for a
shorter score.

This is an STE-flavored adapter, not certified ASD-STE100 output. It improves
form only. It cannot prove that the plan is correct or complete.

## Protected Contract

Shadow mode never rewrites anything. A future guarded rewrite must also leave
these surfaces byte-for-byte unchanged until fixture and live-trial evidence
supports a narrower rule:

- Plan Ledger, scope, non-goals, decisions, acceptance criteria, verification,
  stop gates, preflight contracts, and GSD handoff sections;
- headings and tables;
- fenced code, inline code, commands, paths, URLs, identifiers, and literal
  values.

The initial rewrite-eligible surface is explanatory prose such as rationale,
source descriptions, risk explanations, and slice descriptions.

Use the helper before any guarded candidate can replace the plan:

```bash
bun <intuitive-flow-skill-root>/scripts/plan-prose-gate.ts --compare <before.md> <candidate.md>
```

The helper checks protected sections, headings, tables, code, inline literals,
URLs, paths, code-style identifiers, and numeric literals. Review the candidate
diff for plain-text commands or identifiers that the structural check cannot
classify. Any protected-contract change is a hard stop. Discard the candidate
and keep the canonical plan unchanged.

## Promotion Gate

Do not enable automatic rewriting until representative fixture and live shadow
runs show:

- no protected-contract or semantic regressions;
- a consistent readability improvement beyond the lint score alone;
- acceptable runtime and context cost on supported hosts;
- a low false-positive rate across different plan shapes;
- a clear rollback path to shadow mode.

Record trial evidence outside the canonical plan. Promote, keep advisory, or
remove the adapter based on that evidence instead of adding permanent runtime
ceremony.

## Provenance

The adapter is an independent local contract informed by Ege Celebi's
`ste-writing` experiment at upstream commit `dfa87c32` and ASD-STE100
principles:

- https://github.com/woosal1337/blog/tree/main/videos/ep01-the-cure-for-ai-slop
- https://asd-ste100.org

The upstream Markdown was not copied into the installed skill portfolio. This
reference owns the local behavior and its portability constraints.
