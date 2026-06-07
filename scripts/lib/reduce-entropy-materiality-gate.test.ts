import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type MaterialityGateResult = {
  ok: boolean;
  stop_recommended: boolean;
  quota_saturated: boolean;
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
          materiality: ["false confidence"],
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
          materiality: ["numbering"],
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
          materiality: ["false_confidence"],
          evidence: ["build:all skips link-check"],
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.eligible_count).toBe(1);
    expect(result.quota_saturated).toBe(true);
    expect(result.warnings.join("\n")).toContain("treat the request as a maximum");
  });
});
