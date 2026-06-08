import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { checkSkills } from "./check-skills";

const withTempProject = async (callback: (root: string) => Promise<void> | void) => {
  const root = mkdtempSync(join(tmpdir(), "skill-check-project-"));
  try {
    await callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const writeFixtureFile = (root: string, relativePath: string, text: string) => {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

const optionsFor = (root: string) => ({
  skillsRoot: join(root, "skills"),
  manifestPath: join(root, "scripts", "local-skill-manifest.txt"),
  deprecatedSourceRoot: join(root, "skills-src"),
  externalSkillSourcesPath: undefined,
});

describe("skill checker", () => {
  test("accepts canonical skills with local references", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/local-skill-manifest.txt", "root-skill alpha\n");
      writeFixtureFile(
        root,
        "skills/alpha/SKILL.md",
        "---\nname: \"alpha\"\ndescription: Use when testing skills.\n---\n\nRead `references/guide.md`.\n",
      );
      writeFixtureFile(root, "skills/alpha/references/guide.md", "# Guide\n");

      expect(checkSkills(optionsFor(root))).toEqual([]);
    });
  });

  test("rejects deprecated skills-src files", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/local-skill-manifest.txt", "root-skill alpha\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");
      writeFixtureFile(root, "skills-src/alpha/SKILL.md", "old\n");

      expect(checkSkills(optionsFor(root))).toContain("deprecated generated skill source remains: skills-src/");
    });
  });

  test("uses the manifest as the root skill allowlist", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/local-skill-manifest.txt", "root-skill alpha\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");
      writeFixtureFile(root, "skills/beta/SKILL.md", "---\nname: beta\ndescription: Beta.\n---\n");

      expect(checkSkills(optionsFor(root))).toContain("root skill missing from manifest: beta");
    });
  });

  test("rejects generated includes and missing resource references", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/local-skill-manifest.txt", "root-skill alpha\n");
      writeFixtureFile(
        root,
        "skills/alpha/SKILL.md",
        "---\nname: alpha\ndescription: Alpha.\n---\n\n{{> shared.md}}\nRead `references/missing.md`.\n",
      );

      const errors = checkSkills(optionsFor(root));
      expect(errors).toContain("template include left in canonical skill file: skills/alpha/SKILL.md");
      expect(errors).toContain("missing referenced skill resource in skills/alpha/SKILL.md: references/missing.md");
    });
  });

  test("rejects machine-local checkout paths in skill markdown", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/local-skill-manifest.txt", "root-skill alpha\n");
      writeFixtureFile(
        root,
        "skills/alpha/SKILL.md",
        "---\nname: alpha\ndescription: Alpha.\n---\n\nRun `bun /home/mi/ws/intuitive-flow/skills/alpha/scripts/run.ts`.\n",
      );

      expect(checkSkills(optionsFor(root))).toContain(
        "machine-local checkout path in canonical skill file: skills/alpha/SKILL.md",
      );
    });
  });

  test("rejects missing local links from skill reference files", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/local-skill-manifest.txt", "root-skill alpha\n");
      writeFixtureFile(
        root,
        "skills/alpha/SKILL.md",
        "---\nname: alpha\ndescription: Alpha.\n---\n\nRead `references/guide.md`.\n",
      );
      writeFixtureFile(root, "skills/alpha/references/guide.md", "See [missing](missing.md).\n");

      expect(checkSkills(optionsFor(root))).toContain(
        "missing referenced skill resource in skills/alpha/references/guide.md: references/missing.md",
      );
    });
  });

  test("validates external skill source manifests when configured", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/local-skill-manifest.txt", "root-skill alpha\n");
      writeFixtureFile(root, "scripts/external-skill-sources.txt", "source demo https://example.com/demo all\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");

      const errors = checkSkills({
        ...optionsFor(root),
        externalSkillSourcesPath: join(root, "scripts", "external-skill-sources.txt"),
      });

      expect(errors).toContain("unsupported external skill repo on line 1: https://example.com/demo");
    });
  });

  test("rejects GitHub Actions Bun pins that drift from packageManager", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/local-skill-manifest.txt", "root-skill alpha\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");
      writeFixtureFile(root, "package.json", JSON.stringify({ name: "fixture", packageManager: "bun@1.3.12" }));
      writeFixtureFile(
        root,
        ".github/workflows/verify.yml",
        "steps:\n  - uses: oven-sh/setup-bun@v2\n    with:\n      bun-version: 1.3.6\n",
      );

      const errors = checkSkills({
        ...optionsFor(root),
        packageJsonPath: join(root, "package.json"),
        githubVerifyWorkflowPath: join(root, ".github", "workflows", "verify.yml"),
      });

      expect(errors).toContain(
        "GitHub Actions Bun version drift: package.json packageManager pins bun@1.3.12 but .github/workflows/verify.yml uses bun-version 1.3.6",
      );
    });
  });

  test("requires packageManager when GitHub Actions pins Bun", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/local-skill-manifest.txt", "root-skill alpha\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");
      writeFixtureFile(root, "package.json", JSON.stringify({ name: "fixture" }));
      writeFixtureFile(
        root,
        ".github/workflows/verify.yml",
        "steps:\n  - uses: oven-sh/setup-bun@v2\n    with:\n      bun-version: 1.3.12\n",
      );

      const errors = checkSkills({
        ...optionsFor(root),
        packageJsonPath: join(root, "package.json"),
        githubVerifyWorkflowPath: join(root, ".github", "workflows", "verify.yml"),
      });

      expect(errors).toContain(
        "GitHub Actions pins Bun 1.3.12 but package.json does not declare packageManager: bun@<version>",
      );
    });
  });
});
