import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type MaterialityGateResult = {
  ok: boolean;
  stop_recommended: boolean;
  quota_saturated: boolean;
  open_ended_loop: boolean;
  eligible_count: number;
  rejected_count: number;
  errors: string[];
  warnings: string[];
};

const gatePath = join(process.cwd(), "skills", "intuitive-reduce-entropy", "scripts", "materiality-gate.mjs");
const gateUrl = pathToFileURL(gatePath).href;

const loadGate = async (): Promise<{ evaluate: (payload: unknown) => MaterialityGateResult }> => import(gateUrl);

describe("reduce entropy materiality gate", () => {
  test("accepts candidates with eligible materiality and repo evidence", async () => {
    const { evaluate } = await loadGate();

    const result = evaluate({
      requested_groups: 1,
      candidates: [
        {
          id: "placeholder-link-gate",
          severity: "P1",
          materiality: ["false confidence"],
          impact_radius: "workflow",
          maintainer_test:
            "The docs gate can pass while publishing placeholder links, so reviewers need this protection before trusting link checks.",
          evidence: ["link-check ignores scoped [text](#) links"],
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.stop_recommended).toBe(false);
    expect(result.quota_saturated).toBe(false);
    expect(result.eligible_count).toBe(1);
  });

  test("rejects polish-only work as an entropy group", async () => {
    const { evaluate } = await loadGate();

    const result = evaluate({
      requested_groups: 1,
      candidates: [
        {
          id: "renumber-screenshot-checklist",
          severity: "P2",
          materiality: ["numbering"],
          impact_radius: "single_file",
          maintainer_test: "Small cleanup for consistency.",
          evidence: ["duplicate heading number"],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.stop_recommended).toBe(true);
    expect(result.errors.join("\n")).toContain("support/polish-only work should not be counted");
  });

  test("rejects supporting tests counted without independent materiality", async () => {
    const { evaluate } = await loadGate();

    const result = evaluate({
      requested_groups: 1,
      candidates: [
        {
          id: "route-helper-tests",
          severity: "P2",
          parent_candidate: "route-helper-behavior",
          materiality: ["test_only_support"],
          evidence: ["covers route helper after implementation"],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("supporting work should be grouped");
  });

  test("warns when requested group count exceeds material candidates", async () => {
    const { evaluate } = await loadGate();

    const result = evaluate({
      requested_groups: 5,
      candidates: [
        {
          id: "build-gate-false-green",
          severity: "P1",
          materiality: ["false_confidence"],
          impact_radius: "workflow",
          maintainer_test:
            "The verification command can skip link-checks, so reviewers need this gate before trusting build status.",
          evidence: ["build:all skips link-check"],
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.eligible_count).toBe(1);
    expect(result.quota_saturated).toBe(true);
    expect(result.warnings.join("\n")).toContain("treat the request as a maximum");
  });

  test("rejects isolated low-impact P2 work in open-ended loops", async () => {
    const { evaluate } = await loadGate();

    const result = evaluate({
      open_ended_loop: true,
      requested_groups: 3,
      candidates: [
        {
          id: "template-date-note",
          severity: "P2",
          materiality: ["real_workflow_friction"],
          impact_radius: "single_file",
          maintainer_test: "Small cleanup for consistency.",
          work_type: "metadata_consistency",
          evidence: ["one template has an outdated status date"],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.open_ended_loop).toBe(true);
    expect(result.stop_recommended).toBe(true);
    expect(result.eligible_count).toBe(0);
    expect(result.errors.join("\n")).toContain("isolated low-impact P2 work should be parked or bundled");
    expect(result.errors.join("\n")).toContain("weak cleanup language");
  });
});
