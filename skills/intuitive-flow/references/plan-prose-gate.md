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
4. Let the helper append summary-only trial evidence to the local state file.
5. Report one compact result outside the plan:

   ```text
   Plan prose gate: checked (shadow); findings=<count>; score=<score | unavailable>; rewrite=not-run; record=<event -> state-file | failed | unavailable>.
   ```

The helper is evidence, not a portability requirement. If Bun or the helper is
unavailable in a target repo, complete the inline inspection and report
`score=unavailable; record=unavailable`. Do not block planning or add Bun to the
target repo.

## Local Trial Memory

Successful helper runs append JSONL events to:

```text
${XDG_STATE_HOME:-~/.local/state}/intuitive-flow/plan-prose-gate.jsonl
```

The directory uses mode `0700`; the file uses `0600`. This is local trial state,
not telemetry. It is not written to the target repo or uploaded by Intuitive
Flow.

Each check stores the timestamp, local repo root, repo-relative plan path,
content hash, word and finding counts, protected/eligible counts, and counts by
finding kind. It does not store plan prose or finding excerpts. Repeated checks
remain visible as invocation counts, while reports deduplicate the same plan
content as one snapshot.

Use `--no-record` for a one-off diagnostic that must not enter trial memory.
Use `--state-file <path>` to isolate an experiment or choose another local
state surface.

Review a sample after inspecting its plan and detailed `--json` output:

```bash
bun <intuitive-flow-skill-root>/scripts/plan-prose-gate.ts \
  --review <event-id> <useful|mixed|noise> [short-note]
```

Do not put plan content or secrets in the optional note.

After one week, run:

```bash
bun <intuitive-flow-skill-root>/scripts/plan-prose-gate.ts --report --since 7d
```

The report shows checks, unique plans, unique content snapshots, review
coverage, scores, finding kinds, verdicts, and up to ten high-score samples to
review. Its recommendation uses transparent conservative thresholds:

- fewer than five snapshots: `COLLECT_MORE_SNAPSHOTS`;
- fewer than five reviewed snapshots when five exist: `REVIEW_SAMPLES`;
- at least 50% `noise`: `DROP_OR_RETUNE`;
- at least 60% `useful`: `ADVANCE_TO_CANDIDATE_SHADOW`;
- otherwise: `KEEP_SHADOW`.

The recommendation never changes runtime behavior automatically. Candidate
shadow is still required before any guarded rewrite.

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

Record trial evidence in the local trial-memory JSONL, not the canonical plan.
Promote, keep advisory, or remove the adapter based on the weekly report and
reviewed samples instead of adding permanent runtime ceremony.

## Provenance

The adapter is an independent local contract informed by Ege Celebi's
`ste-writing` experiment at upstream commit `dfa87c32` and ASD-STE100
principles:

- https://github.com/woosal1337/blog/tree/main/videos/ep01-the-cure-for-ai-slop
- https://asd-ste100.org

The upstream Markdown was not copied into the installed skill portfolio. This
reference owns the local behavior and its portability constraints.
