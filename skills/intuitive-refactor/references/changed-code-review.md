# Changed Code Review

Use this mode for diff-scoped cleanup after implementation or when the user asks
to review changed code for reuse, quality, or efficiency. This is the migrated
`simplify` workflow; do not treat it as broad architecture discovery.

## Scope Selection

Use the smallest changed scope that answers the request:

- no argument: review uncommitted changes;
- path argument: review `git diff -- <path>`;
- ref argument: review `git diff <ref>...HEAD`;
- committed slice: review the base ref or commit range named by the plan;
- docs/plans-only change: skip unless the user explicitly asks for code-review
  style feedback on prose.

If no changes are found, report `No changes to review.` and stop.

## Three Lenses

### Reuse

Look for missed reuse and duplication:

- new helpers that duplicate existing utilities;
- hand-rolled string, path, environment, parsing, or type-guard logic where the
  repo already has a pattern;
- copy-paste with small variations that should share an existing abstraction.

Record file/line, the missed reuse, the existing pattern if known, and whether
the issue is worth fixing now.

### Quality

Look for maintainability regressions:

- redundant state or derived values stored as source of truth;
- parameter sprawl instead of a cleaner boundary;
- leaky abstractions or exposed implementation detail;
- stringly-typed values where constants, enums, or typed unions already exist;
- unnecessary wrapper markup/components or nesting;
- deeply nested branches that should flatten through guards, lookup tables, or
  direct returns;
- comments that narrate obvious code instead of explaining a non-obvious why.

Classify findings as `MUST_FIX`, `IMPROVE`, or `NITPICK`.

### Efficiency

Look for avoidable work:

- repeated file reads, network calls, computations, or broad scans;
- independent operations run sequentially when parallelism is safe;
- hot-path blocking work;
- unconditional state/store updates in polling, intervals, or event handlers;
- existence pre-checks where operating directly and handling errors is safer;
- unbounded memory growth or missing cleanup;
- loading all data when the changed code only needs a slice.

Classify findings as `MUST_FIX`, `IMPROVE`, or `NITPICK`.

## Report Or Fix

When fixes are not clearly authorized, stop after findings. Include:

```text
Changed-code review:
Scope:
Reuse:
Quality:
Efficiency:
Recommended fixes:
Skipped:
Proof to rerun:
```

When fixes are authorized:

1. Re-read each cited location.
2. Discard false positives.
3. Apply the smallest valid fix.
4. Skip `NITPICK` unless the user explicitly asked for all fixes.
5. Rerun the relevant proof after code changes.

Do not broaden into adjacent architecture cleanup. Park broader findings for a
future `$intuitive-reduce-entropy` or normal `$intuitive-refactor` scope gate.
