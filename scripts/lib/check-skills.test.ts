import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { checkSkills } from "./check-skills";
import { skillSizeReport } from "./check-skills";

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
  allowlistPath: join(root, "scripts", "default-skill-allowlist.txt"),
  pruneLedgerPath: join(root, "scripts", "default-skill-prune-ledger.txt"),
  deprecatedSourceRoot: join(root, "skills-src"),
  gstackCodexSkillsRoot: join(root, "vendor", "gstack", ".agents", "skills"),
});

describe("skill checker", () => {
  test("accepts canonical skills with local references", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\n");
      writeFixtureFile(
        root,
        "skills/alpha/SKILL.md",
        "---\nname: \"alpha\"\ndescription: Use when testing skills.\n---\n\nRead `references/guide.md`.\n",
      );
      writeFixtureFile(root, "skills/alpha/references/guide.md", "# Guide\n");

      expect(checkSkills(optionsFor(root))).toEqual([]);
    });
  });

  test("accepts shared references outside individual skill directories", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\nroot-skill beta\n");
      writeFixtureFile(
        root,
        "skills/alpha/SKILL.md",
        "---\nname: alpha\ndescription: Alpha.\n---\n\nRead `../_shared/references/durable-run.md`.\n",
      );
      writeFixtureFile(
        root,
        "skills/beta/SKILL.md",
        "---\nname: beta\ndescription: Beta.\n---\n\nSee [shared](../_shared/references/durable-run.md).\n",
      );
      writeFixtureFile(root, "skills/_shared/references/durable-run.md", "# Durable Run\n");

      expect(checkSkills(optionsFor(root))).toEqual([]);
    });
  });

  test("rejects missing shared references", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\n");
      writeFixtureFile(
        root,
        "skills/alpha/SKILL.md",
        "---\nname: alpha\ndescription: Alpha.\n---\n\nRead `../_shared/references/missing.md`.\n",
      );

      expect(checkSkills(optionsFor(root))).toContain(
        "missing referenced skill resource in skills/alpha/SKILL.md: ../_shared/references/missing.md",
      );
    });
  });

  test("rejects deprecated skills-src files", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");
      writeFixtureFile(root, "skills-src/alpha/SKILL.md", "old\n");

      expect(checkSkills(optionsFor(root))).toContain("deprecated generated skill source remains: skills-src/");
    });
  });

  test("uses the default allowlist as the root skill allowlist", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");
      writeFixtureFile(root, "skills/beta/SKILL.md", "---\nname: beta\ndescription: Beta.\n---\n");

      expect(checkSkills(optionsFor(root))).toContain("root skill missing from default allowlist: beta");
    });
  });

  test("rejects generated includes and missing resource references", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\n");
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

  test("rejects skill frontmatter outside SKILL.md entrypoints", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");
      writeFixtureFile(
        root,
        "skills/alpha/references/guide.md",
        "---\nname: alpha\ndescription: Drift-prone duplicate metadata.\n---\n\n# Guide\n",
      );

      expect(checkSkills(optionsFor(root))).toContain(
        "non-entrypoint markdown must not have skill frontmatter: skills/alpha/references/guide.md",
      );
    });
  });

  test("rejects machine-local checkout paths in skill markdown", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\n");
      writeFixtureFile(
        root,
        "skills/alpha/SKILL.md",
        `---\nname: alpha\ndescription: Alpha.\n---\n\nRun \`bun ${root}/skills/alpha/scripts/run.ts\`.\n`,
      );

      expect(checkSkills(optionsFor(root))).toContain(
        "machine-local checkout path in canonical skill file: skills/alpha/SKILL.md",
      );
    });
  });

  test("rejects missing local links from skill reference files", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\n");
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

  test("validates external skill entries in the default allowlist", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\nexternal-skill demo https://example.com/demo alpha\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");

      const errors = checkSkills(optionsFor(root));

      expect(errors).toContain("unsupported external skill repo on line 2: https://example.com/demo");
    });
  });

  test("keeps prune-only legacy entries out of the default allowlist", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\nlegacy-skill old-alpha\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");

      expect(checkSkills(optionsFor(root))).toContain(
        "default skill allowlist must not contain prune-only legacy entries on line 2: legacy-skill old-alpha",
      );
    });
  });

  test("rejects prune ledger entries that target current skills", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\n");
      writeFixtureFile(root, "scripts/default-skill-prune-ledger.txt", "legacy-skill alpha\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");

      expect(checkSkills(optionsFor(root))).toContain("prune ledger lists current skill as legacy: alpha");
    });
  });

  test("rejects allowlisted GStack skills missing from the vendored wrapper surface", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\ngstack-skill gstack-review\n");
      writeFixtureFile(root, "skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Alpha.\n---\n");
      writeFixtureFile(root, "vendor/gstack/.agents/skills/gstack-browse/SKILL.md", "# Browse\n");

      expect(checkSkills(optionsFor(root))).toContain("default allowlist lists missing vendored GStack skill: gstack-review");
    });
  });

  test("rejects GitHub Actions Bun pins that drift from packageManager", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\n");
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
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\n");
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

  test("reports skill entrypoint sizes without failing structural checks", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill alpha\nroot-skill beta\n");
      writeFixtureFile(
        root,
        "skills/alpha/SKILL.md",
        "---\nname: alpha\ndescription: Alpha.\n---\n\n" + "detail\n".repeat(4),
      );
      writeFixtureFile(
        root,
        "skills/beta/SKILL.md",
        "---\nname: beta\ndescription: Beta.\n---\n\n" + "detail\n".repeat(12),
      );

      expect(checkSkills(optionsFor(root))).toEqual([]);
      expect(skillSizeReport(join(root, "skills"), { maxChars: 80, maxLines: 10 })).toEqual([
        {
          skillName: "beta",
          chars: 123,
          lines: 17,
          overBudget: true,
        },
        {
          skillName: "alpha",
          chars: 69,
          lines: 9,
          overBudget: false,
        },
      ]);
    });
  });

  test("requires convergence handoff markers on primary workflow skills", async () => {
    await withTempProject((root) => {
      writeFixtureFile(root, "scripts/default-skill-allowlist.txt", "root-skill agent-planning-loop\n");
      writeFixtureFile(
        root,
        "skills/agent-planning-loop/SKILL.md",
        "---\nname: agent-planning-loop\ndescription: Planning loop.\n---\n\nNext execution route:\n- $intuitive-flow\n",
      );

      const errors = checkSkills(optionsFor(root));

      expect(errors).toContain(
        "missing workflow handoff marker in skills/agent-planning-loop/SKILL.md: Plan artifact:",
      );
      expect(errors).toContain(
        "missing workflow handoff marker in skills/agent-planning-loop/SKILL.md: Recommended next action:",
      );
      expect(errors).toContain(
        "missing workflow handoff marker in skills/agent-planning-loop/SKILL.md: Shortcut:",
      );
    });
  });
});
