import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTrialReport,
  comparePlanInvariants,
  defaultTrialStateFile,
  lintPlanProse,
  readTrialEvents,
  recordShadowCheck,
  recordTrialReview,
} from "./plan-prose-gate";

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
    expect(gate).toContain("Do not block planning or add Bun");
    expect(gate).toContain("rewrite=not-run");
    expect(gate).toContain("plan-prose-gate.jsonl");
    expect(gate).toContain("--report --since 7d");
    expect(skill).toContain("references/plan-prose-gate.md");
    expect(sourceOfTruth).toContain("shadow result is checkpoint evidence");
  });
});

describe("plan prose trial memory", () => {
  test("uses the XDG state directory without touching the target repo", () => {
    expect(defaultTrialStateFile({ XDG_STATE_HOME: "/tmp/demo-state" }, "/tmp/demo-home"))
      .toBe("/tmp/demo-state/intuitive-flow/plan-prose-gate.jsonl");
    expect(defaultTrialStateFile({}, "/tmp/demo-home"))
      .toBe("/tmp/demo-home/.local/state/intuitive-flow/plan-prose-gate.jsonl");
  });

  test("records summary-only events with private local permissions", () => {
    const root = mkdtempSync(join(tmpdir(), "plan-prose-memory-"));
    try {
      mkdirSync(join(root, ".git"));
      mkdirSync(join(root, "docs", "plans"), { recursive: true });
      const plan = join(root, "docs", "plans", "demo.md");
      const stateFile = join(root, "local-state", "events.jsonl");
      const markdown = "# Plan\n\n## Rationale\n\nThis robust plan is intentionally long enough to create a useful local trial record without storing this sentence.\n";
      writeFileSync(plan, markdown);
      const event = recordShadowCheck(plan, markdown, lintPlanProse(markdown), stateFile, new Date("2026-08-01T00:00:00Z"));
      const stateText = readFileSync(stateFile, "utf8");

      expect(event.planPath).toBe("docs/plans/demo.md");
      expect(stateText).toContain(event.eventId);
      expect(stateText).not.toContain("This robust plan");
      expect(statSync(stateFile).mode & 0o777).toBe(0o600);
      expect(statSync(join(root, "local-state")).mode & 0o777).toBe(0o700);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("deduplicates repeated checks by plan snapshot and carries review labels", () => {
    const root = mkdtempSync(join(tmpdir(), "plan-prose-report-"));
    try {
      mkdirSync(join(root, ".git"));
      const plan = join(root, "plan.md");
      const stateFile = join(root, "state", "events.jsonl");
      const markdown = "# Plan\n\n## Rationale\n\nThis robust plan helps.\n";
      writeFileSync(plan, markdown);
      const result = lintPlanProse(markdown);
      const first = recordShadowCheck(plan, markdown, result, stateFile, new Date("2026-08-01T00:00:00Z"));
      recordShadowCheck(plan, markdown, result, stateFile, new Date("2026-08-02T00:00:00Z"));
      recordTrialReview(first.eventId, "useful", "real wording issue", stateFile, new Date("2026-08-02T01:00:00Z"));

      const parsed = readTrialEvents(stateFile);
      const report = buildTrialReport(parsed.events, new Date("2026-07-31T00:00:00Z"), parsed.malformedLineCount);
      expect(report.checkCount).toBe(2);
      expect(report.uniquePlanCount).toBe(1);
      expect(report.uniqueSnapshotCount).toBe(1);
      expect(report.reviewedSnapshotCount).toBe(1);
      expect(report.verdicts.useful).toBe(1);
      expect(report.recommendation).toBe("COLLECT_MORE_SNAPSHOTS");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("recommends candidate shadow only after enough reviewed useful snapshots", () => {
    const root = mkdtempSync(join(tmpdir(), "plan-prose-decision-"));
    try {
      mkdirSync(join(root, ".git"));
      const plan = join(root, "plan.md");
      const stateFile = join(root, "state", "events.jsonl");
      for (let index = 0; index < 5; index += 1) {
        const markdown = `# Plan\n\n## Rationale\n\nThis robust plan uses snapshot ${index}.\n`;
        writeFileSync(plan, markdown);
        const check = recordShadowCheck(
          plan,
          markdown,
          lintPlanProse(markdown),
          stateFile,
          new Date(`2026-08-0${index + 1}T00:00:00Z`),
        );
        recordTrialReview(
          check.eventId,
          index < 3 ? "useful" : "mixed",
          undefined,
          stateFile,
          new Date(`2026-08-0${index + 1}T01:00:00Z`),
        );
      }

      const parsed = readTrialEvents(stateFile);
      const report = buildTrialReport(parsed.events, new Date("2026-07-31T00:00:00Z"));
      expect(report.uniqueSnapshotCount).toBe(5);
      expect(report.reviewedSnapshotCount).toBe(5);
      expect(report.verdicts).toEqual({ useful: 3, mixed: 2, noise: 0, unreviewed: 0 });
      expect(report.recommendation).toBe("ADVANCE_TO_CANDIDATE_SHADOW");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("runs check, review, and weekly report through the CLI", () => {
    const root = mkdtempSync(join(tmpdir(), "plan-prose-cli-"));
    try {
      mkdirSync(join(root, ".git"));
      const plan = join(root, "plan.md");
      const stateFile = join(root, "state", "events.jsonl");
      const script = join(process.cwd(), "skills", "intuitive-flow", "scripts", "plan-prose-gate.ts");
      writeFileSync(plan, "# Plan\n\n## Rationale\n\nThis robust plan helps.\n");

      const check = spawnSync(process.execPath, [script, "--state-file", stateFile, plan], { encoding: "utf8" });
      expect(check.status).toBe(0);
      const event = readTrialEvents(stateFile).events.find((item) => item.type === "check");
      expect(event?.type).toBe("check");

      const review = spawnSync(
        process.execPath,
        [script, "--state-file", stateFile, "--review", event!.eventId, "useful", "clear signal"],
        { encoding: "utf8" },
      );
      expect(review.status).toBe(0);
      expect(review.stdout).toContain("verdict=useful");

      const report = spawnSync(
        process.execPath,
        [script, "--state-file", stateFile, "--report", "--since", "7d"],
        { encoding: "utf8" },
      );
      expect(report.status).toBe(0);
      expect(report.stdout).toContain("unique_snapshots=1");
      expect(report.stdout).toContain("useful=1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("counts invalid state lines without breaking the report", () => {
    const root = mkdtempSync(join(tmpdir(), "plan-prose-malformed-"));
    try {
      const stateFile = join(root, "events.jsonl");
      const incompleteCheck = {
        schemaVersion: 1,
        type: "check",
        eventId: "incomplete",
        timestamp: "not-a-date",
        adapter: "ste-flavored-v1",
        mode: "shadow",
        repoRoot: root,
        repoName: "demo",
        planPath: "plan.md",
        contentHash: "abc",
        result: {},
      };
      writeFileSync(stateFile, `not json\n${JSON.stringify(incompleteCheck)}\n`);
      const parsed = readTrialEvents(stateFile);
      expect(parsed.events).toEqual([]);
      expect(parsed.malformedLineCount).toBe(2);
      expect(buildTrialReport(parsed.events, new Date(0), parsed.malformedLineCount).malformedLineCount).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
