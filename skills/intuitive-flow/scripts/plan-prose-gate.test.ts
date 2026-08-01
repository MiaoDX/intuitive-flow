import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comparePlanInvariants, lintPlanProse } from "./plan-prose-gate";

describe("plan prose gate", () => {
  test("reports STE-flavored prose findings without linting literals or tables", () => {
    const result = lintPlanProse(`# Plan

## Rationale

It is important to note that this robust adapter is utilized by the workflow, and it is designed to provide a seamless way to process all of the available planning inputs without requiring any additional configuration from the maintainer.

| Command | Result |
| --- | --- |
| \`bun run verify\` | robust |

\`robust --flag\` stays literal.
`);

    expect(result.findingCount).toBeGreaterThan(0);
    expect(result.rewriteEligibleFindingCount).toBe(result.findingCount);
    expect(result.findings.some((finding) => finding.kind === "long_sentence")).toBe(true);
    expect(result.findings.some((finding) => finding.kind === "marketing_word")).toBe(true);
    expect(result.findings.every((finding) => !finding.text.includes("bun run verify"))).toBe(true);
  });

  test("classifies findings in contract sections as protected", () => {
    const result = lintPlanProse(`# Plan

## Acceptance Criteria

- The robust workflow is accepted by the reviewer.

## Rationale

The seamless workflow helps maintainers.
`);

    expect(result.protectedFindingCount).toBeGreaterThan(0);
    expect(result.rewriteEligibleFindingCount).toBeGreaterThan(0);
  });

  test("allows explanatory prose changes when protected invariants stay exact", () => {
    const before = `# Plan

## Acceptance Criteria

- Run \`bun test\`.

## Rationale

It is important to note that this robust tool helps maintainers.
`;
    const candidate = `# Plan

## Acceptance Criteria

- Run \`bun test\`.

## Rationale

This tool helps maintainers.
`;

    expect(comparePlanInvariants(before, candidate)).toEqual({ ok: true, changed: [] });
    expect(lintPlanProse(candidate).scorePer100Words).toBeLessThan(lintPlanProse(before).scorePer100Words);
  });

  test("rejects candidate changes to literals and protected sections", () => {
    const before = `# Plan

## Verification

- Run \`bun test\` against https://example.test/v1 for parsePlan in src/plan.ts.
`;
    const candidate = `# Plan

## Verification

- Run \`bun run test\` against https://example.test/v2 for parsePlans in src/plans.ts.
`;

    const result = comparePlanInvariants(before, candidate);
    expect(result.ok).toBe(false);
    expect(result.changed).toContain("inline literals");
    expect(result.changed).toContain("URLs");
    expect(result.changed).toContain("paths");
    expect(result.changed).toContain("identifiers");
    expect(result.changed).toContain("protected sections");
  });

  test("rejects table and numeric literal changes outside protected sections", () => {
    const before = `# Plan

## Rationale

| Limit | Value |
| --- | --- |
| retries | 3 |

Wait 30s before retrying.
`;
    const candidate = before.replace("| retries | 3 |", "| retries | 5 |").replace("30s", "60s");

    const result = comparePlanInvariants(before, candidate);
    expect(result.ok).toBe(false);
    expect(result.changed).toContain("tables");
    expect(result.changed).toContain("numeric literals");
  });

  test("protects nested content under a contract section", () => {
    const before = `# Plan

## Acceptance Criteria

### Runtime

The workflow returns a clear result.

## Rationale

The workflow is easy to inspect.
`;
    const candidate = before.replace("returns a clear result", "usually returns a result");

    expect(comparePlanInvariants(before, candidate).changed).toContain("protected sections");
  });

  test("ignores headings and prose inside tilde fences", () => {
    const before = `# Plan

## Rationale

~~~markdown
## Not A Real Section
This robust sentence is not plan prose.
~~~

This sentence is plain prose.
`;
    const candidate = before.replace("Not A Real Section", "Still Not A Section");
    const lint = lintPlanProse(before);
    const compare = comparePlanInvariants(before, candidate);

    expect(lint.findings.every((finding) => !finding.text.includes("robust"))).toBe(true);
    expect(compare.changed).toContain("fenced code");
    expect(compare.changed).not.toContain("headings");
  });
});

describe("plan prose gate workflow contract", () => {
  const repoRoot = process.cwd();
  const flowRoot = join(repoRoot, "skills", "intuitive-flow");
  const read = (path: string) => readFileSync(join(flowRoot, path), "utf8");

  test("runs after planning reconciliation and before execution intake", () => {
    const intake = read("references/plan-intake-and-autoplan.md");
    const reconciliation = intake.indexOf("## Autoplan Reconciliation");
    const proseGate = intake.indexOf("## Plan Prose Finalization");
    const executionGate = intake.indexOf("## Plan-Backed Execution Gate");

    expect(reconciliation).toBeGreaterThanOrEqual(0);
    expect(proseGate).toBeGreaterThan(reconciliation);
    expect(executionGate).toBeGreaterThan(proseGate);
  });

  test("keeps the trial report-only and portable", () => {
    const gate = read("references/plan-prose-gate.md");
    const skill = read("SKILL.md");
    const sourceOfTruth = read("references/source-of-truth.md");

    expect(gate).toContain("Shadow mode is report-only");
    expect(gate).toContain("Do not block planning or add Bun to the target repo");
    expect(gate).toContain("rewrite=not-run");
    expect(skill).toContain("references/plan-prose-gate.md");
    expect(sourceOfTruth).toContain("shadow result is checkpoint evidence");
  });
});
