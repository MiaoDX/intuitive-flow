import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

describe("portable concurrent status contract", () => {
  test("keeps target-repo state discovery portable", () => {
    const durable = read("skills/_shared/references/durable-run.md");
    const sourceOfTruth = read("skills/intuitive-flow/references/source-of-truth.md");

    expect(durable).toContain("Repo-local guidance and existing source-of-truth conventions win");
    expect(durable).toContain("Treat project status as optional");
    expect(durable).toContain("available host/session persistence when repo policy forbids a task artifact");
    expect(sourceOfTruth).toContain("record project status as `not present/not adopted`");
    expect(sourceOfTruth).not.toContain("check `STATUS.md` at both ends");

    const hotResume = read("skills/intuitive-flow/references/context-budget-and-loop-guard.md");
    expect(hotResume).toContain("When it selects host/session\npersistence");
    expect(hotResume).not.toContain("(`docs/status/active/<plan-slug>.md` for plan-backed runs)");
  });

  test("separates project, task, and worker write authority", () => {
    const durable = read("skills/_shared/references/durable-run.md");
    const runner = read("skills/skill-runner/SKILL.md");
    const closeout = read("skills/intuitive-flow/templates/closeout.md");

    expect(durable).toContain("**Project integrator:**");
    expect(durable).toContain("**Task control plane:**");
    expect(durable).toContain("**Worker:**");
    expect(durable).toContain("This is cooperative ownership, not a filesystem lock");
    expect(runner).toContain("They must not edit a\nproject-status surface");
    expect(closeout).toContain("Delta: <none | material:");
    expect(closeout).toContain("handed off to project integrator");
  });

  test("bounds project status without bypassing writer ownership", () => {
    const sourceOfTruth = read("skills/intuitive-flow/references/source-of-truth.md");

    expect(sourceOfTruth).toContain("120 lines as a soft budget");
    expect(sourceOfTruth).toContain("200 lines as a hard closeout limit");
    expect(sourceOfTruth).toContain("compact the document before commit and closeout");
    expect(sourceOfTruth).toContain("not permission for a worker or unassigned task");
    expect(sourceOfTruth).toContain("parked cleanup signal");
    expect(sourceOfTruth).toContain("invoke an AI from a commit hook");
  });

  test("removes terminal state from active namespaces after reconciliation", () => {
    const durable = read("skills/_shared/references/durable-run.md");
    const ratchet = read("skills/intuitive-refactor/references/ratchet-campaign.md");

    expect(durable).toContain("On `DONE`, `SUPERSEDED`, or `ABSORBED`");
    expect(durable).toContain("Then remove the capsule from the active namespace");
    expect(durable).toContain("skill installation\nmust not rewrite target repos");
    expect(ratchet).toContain("then remove the capsule from the active namespace");
  });

  test("auto-commits verified owned slices unless a traceable blocker applies", () => {
    const flow = read("skills/intuitive-flow/SKILL.md");
    const closeout = read("skills/intuitive-flow/references/refactor-and-closeout.md");
    const routeBrief = read("skills/intuitive-flow/templates/route-brief.md");

    expect(flow).toContain("auto-commit\neach coherent verified owned slice by default");
    expect(flow).toContain("Do not wait for a separate user\nrequest to commit");
    expect(closeout).toContain("request to execute the work authorizes commits of verified owned changes");
    expect(closeout).toContain("Unrelated dirty files outside the slice");
    expect(closeout).toContain("every verified owned file is\ncommitted");
    expect(routeBrief).toContain("auto-commit verified owned slices");
  });

  test("keeps initializer adoption conditional and local", () => {
    const initializer = read("skills/intuitive-init/SKILL.md");

    expect(initializer).toContain("When durable Intuitive workflow adoption is in scope");
    expect(initializer).toContain("Do not create `STATUS.md`, a validator, or a status directory");
  });
});
