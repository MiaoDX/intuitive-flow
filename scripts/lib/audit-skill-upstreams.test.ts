import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditSkillUpstreams, discoverSkills, formatAuditMarkdown } from "./audit-skill-upstreams";
import { parseDefaultSkillAllowlistText } from "./default-skill-allowlist";

const writeSkill = (root: string, name: string, description: string) => {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(
    join(root, name, "SKILL.md"),
    [
      "---",
      `name: ${name}`,
      `description: ${description}`,
      "---",
      "",
    ].join("\n"),
  );
};

describe("skill upstream audit", () => {
  test("discovers skills from a local source directory", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-source-"));
    try {
      writeSkill(root, "alpha", "Alpha skill.");
      writeSkill(root, "beta", "Beta skill.");

      expect(discoverSkills(root)).toEqual([
        { name: "alpha", description: "Alpha skill.", path: "alpha/SKILL.md" },
        { name: "beta", description: "Beta skill.", path: "beta/SKILL.md" },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not recurse into resources under a skill directory", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-source-"));
    try {
      writeSkill(root, "umbrella", "Umbrella skill.");
      writeSkill(join(root, "umbrella", "nested"), "nested", "Nested resource.");

      expect(discoverSkills(root)).toEqual([
        { name: "umbrella", description: "Umbrella skill.", path: "umbrella/SKILL.md" },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports candidates outside the allowlist without mutating it", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-audit-"));
    const source = join(root, "source");
    try {
      writeSkill(source, "keep", "Keep this.");
      writeSkill(source, "candidate", "Consider this.");
      const allowlist = parseDefaultSkillAllowlistText("external-skill demo owner/demo keep\n");

      const audit = auditSkillUpstreams(allowlist, {
        includeGstack: false,
        noClone: true,
        repoRoot: root,
        sourceDirs: new Map([["demo", source]]),
      });

      const markdown = formatAuditMarkdown(audit);
      expect(markdown).toContain("## demo");
      expect(markdown).toContain("`candidate` - Consider this.");
      expect(markdown).toContain("Allowlisted but not found upstream:\n- none");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("limits verbose markdown candidates while preserving a full audit model", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-audit-limit-"));
    const source = join(root, "source");
    try {
      writeSkill(source, "keep", "Keep this.");
      writeSkill(source, "candidate-a", "A".repeat(220));
      writeSkill(source, "candidate-b", "B candidate.");
      const allowlist = parseDefaultSkillAllowlistText("external-skill demo owner/demo keep\n");

      const audit = auditSkillUpstreams(allowlist, {
        includeGstack: false,
        noClone: true,
        repoRoot: root,
        sourceDirs: new Map([["demo", source]]),
      });

      const markdown = formatAuditMarkdown(audit, { maxCandidatesPerSource: 1, maxDescriptionChars: 32 });
      expect(audit.sources[0]?.discovered.map((skill) => skill.name)).toEqual(["candidate-a", "candidate-b", "keep"]);
      expect(markdown).toContain("Showing 1 of 2.");
      expect(markdown).toContain("AAAAAAAAAAAAAAAAAAAAAAAAAAAAA...");
      expect(markdown).not.toContain("candidate-b");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("marks source unavailable when cloning is disabled and no source dir is provided", () => {
    const allowlist = parseDefaultSkillAllowlistText("external-skill demo owner/demo keep\n");

    const audit = auditSkillUpstreams(allowlist, {
      includeGstack: false,
      noClone: true,
      repoRoot: process.cwd(),
      sourceDirs: new Map(),
    });

    expect(audit.sources[0]?.unavailable).toBe("no source directory provided and cloning disabled");
  });
});
