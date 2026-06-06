import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncExternalSkillState, syncGstackSkillState } from "./managed-skill-state";

const repoRoot = process.cwd();

const writeExternalManifest = (root: string, text: string) => {
  const manifestPath = join(root, "external-skill-sources.txt");
  writeFileSync(manifestPath, text);
  return manifestPath;
};

describe("managed skill state", () => {
  test("seeds gstack Codex state without deleting before prior ownership exists", () => {
    const home = mkdtempSync(join(tmpdir(), "managed-skills-home-"));
    const repo = mkdtempSync(join(tmpdir(), "managed-skills-gstack-"));
    try {
      mkdirSync(join(repo, ".agents", "skills", "gstack-review"), { recursive: true });
      writeFileSync(join(repo, ".agents", "skills", "gstack-review", "SKILL.md"), "# Review\n");
      mkdirSync(join(home, ".codex", "skills", "gstack-stale"), { recursive: true });
      writeFileSync(join(home, ".codex", "skills", "gstack-stale", "SKILL.md"), "# User stale-looking skill\n");

      const removed = syncGstackSkillState(repo, home);

      expect(removed).toBe(0);
      expect(existsSync(join(home, ".codex", "skills", "gstack-stale", "SKILL.md"))).toBe(true);
      expect(JSON.parse(readFileSync(join(home, ".intuitive-flow", "gstack-codex-skills.json"), "utf8"))).toEqual({
        schemaVersion: 1,
        source: "garrytan/gstack",
        skills: ["gstack-review"],
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("prunes stale gstack Codex symlinks that point into the managed repo", () => {
    const home = mkdtempSync(join(tmpdir(), "managed-skills-home-"));
    const repo = mkdtempSync(join(tmpdir(), "managed-skills-gstack-"));
    try {
      mkdirSync(join(repo, ".agents", "skills", "gstack-review"), { recursive: true });
      mkdirSync(join(repo, ".agents", "skills", "gstack-old"), { recursive: true });
      writeFileSync(join(repo, ".agents", "skills", "gstack-review", "SKILL.md"), "# Review\n");
      writeFileSync(join(repo, ".agents", "skills", "gstack-old", "SKILL.md"), "# Old\n");
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      symlinkSync(join(repo, ".agents", "skills", "gstack-review"), join(home, ".codex", "skills", "gstack-review"));
      symlinkSync(join(repo, ".agents", "skills", "gstack-old"), join(home, ".codex", "skills", "gstack-old"));

      expect(syncGstackSkillState(repo, home, join(home, ".codex"), "full")).toBe(0);
      rmSync(join(repo, ".agents", "skills", "gstack-old"), { recursive: true, force: true });

      const removed = syncGstackSkillState(repo, home, join(home, ".codex"), "full");

      expect(removed).toBe(1);
      expect(existsSync(join(home, ".codex", "skills", "gstack-review", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "gstack-old"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("standard gstack surface prunes owned Codex and Claude skills outside the allowlist", () => {
    const home = mkdtempSync(join(tmpdir(), "managed-skills-home-"));
    const repo = mkdtempSync(join(tmpdir(), "managed-skills-gstack-"));
    try {
      for (const skillName of ["gstack-review", "gstack-benchmark", "gstack-qa"]) {
        mkdirSync(join(repo, ".agents", "skills", skillName), { recursive: true });
        writeFileSync(join(repo, ".agents", "skills", skillName, "SKILL.md"), `---\nname: ${skillName}\ndescription: ${skillName}.\n---\n`);
      }
      for (const skillName of ["review", "benchmark", "qa"]) {
        mkdirSync(join(repo, skillName), { recursive: true });
        writeFileSync(join(repo, skillName, "SKILL.md"), `---\nname: ${skillName}\ndescription: ${skillName}.\n---\n`);
      }
      mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
      writeFileSync(
        join(home, ".intuitive-flow", "gstack-codex-skills.json"),
        JSON.stringify({ schemaVersion: 1, source: "garrytan/gstack", skills: ["gstack-review", "gstack-benchmark", "gstack-qa"] }),
      );
      writeFileSync(
        join(home, ".intuitive-flow", "gstack-claude-skills.json"),
        JSON.stringify({ schemaVersion: 1, source: "garrytan/gstack", skills: ["review", "benchmark", "qa"] }),
      );
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      symlinkSync(join(repo, ".agents", "skills", "gstack-review"), join(home, ".codex", "skills", "gstack-review"));
      symlinkSync(join(repo, ".agents", "skills", "gstack-benchmark"), join(home, ".codex", "skills", "gstack-benchmark"));
      symlinkSync(join(repo, ".agents", "skills", "gstack-qa"), join(home, ".codex", "skills", "gstack-qa"));
      mkdirSync(join(home, ".claude", "skills", "review"), { recursive: true });
      mkdirSync(join(home, ".claude", "skills", "benchmark"), { recursive: true });
      mkdirSync(join(home, ".claude", "skills", "qa"), { recursive: true });
      symlinkSync(join(repo, "review", "SKILL.md"), join(home, ".claude", "skills", "review", "SKILL.md"));
      symlinkSync(join(repo, "benchmark", "SKILL.md"), join(home, ".claude", "skills", "benchmark", "SKILL.md"));
      symlinkSync(join(repo, "qa", "SKILL.md"), join(home, ".claude", "skills", "qa", "SKILL.md"));

      const removed = syncGstackSkillState(repo, home);

      expect(removed).toBe(2);
      expect(existsSync(join(home, ".codex", "skills", "gstack-review", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "gstack-qa", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "gstack-benchmark"))).toBe(false);
      expect(existsSync(join(home, ".claude", "skills", "review", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".claude", "skills", "qa", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".claude", "skills", "benchmark"))).toBe(false);
      expect(JSON.parse(readFileSync(join(home, ".intuitive-flow", "gstack-codex-skills.json"), "utf8")).skills).toEqual([
        "gstack-qa",
        "gstack-review",
      ]);
      expect(JSON.parse(readFileSync(join(home, ".intuitive-flow", "gstack-claude-skills.json"), "utf8")).skills).toEqual([
        "_gstack-command",
        "gstack",
        "qa",
        "review",
      ]);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("prunes stale external allowlist skills while preserving unowned user skills", () => {
    const home = mkdtempSync(join(tmpdir(), "managed-skills-home-"));
    const root = mkdtempSync(join(tmpdir(), "managed-skills-manifest-"));
    try {
      const manifestPath = writeExternalManifest(root, "source demo owner/demo allowlist keep\n");
      mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
      writeFileSync(
        join(home, ".intuitive-flow", "external-skills-demo.json"),
        JSON.stringify({ schemaVersion: 1, source: "owner/demo", skills: ["keep", "remove"] }),
      );
      mkdirSync(join(home, ".agents", "skills", "keep"), { recursive: true });
      mkdirSync(join(home, ".agents", "skills", "remove"), { recursive: true });
      mkdirSync(join(home, ".agents", "skills", "user-skill"), { recursive: true });
      mkdirSync(join(home, ".claude", "skills", "remove"), { recursive: true });
      writeFileSync(
        join(home, ".agents", ".skill-lock.json"),
        JSON.stringify({
          skills: {
            keep: { source: "owner/demo" },
            remove: { source: "owner/demo" },
            "user-skill": { source: "someone/else" },
          },
        }),
      );

      const removed = syncExternalSkillState(manifestPath, "demo", home);

      expect(removed).toBe(2);
      expect(existsSync(join(home, ".agents", "skills", "keep"))).toBe(true);
      expect(existsSync(join(home, ".agents", "skills", "remove"))).toBe(false);
      expect(existsSync(join(home, ".claude", "skills", "remove"))).toBe(false);
      expect(existsSync(join(home, ".agents", "skills", "user-skill"))).toBe(true);
      expect(JSON.parse(readFileSync(join(home, ".agents", ".skill-lock.json"), "utf8")).skills.remove).toBeUndefined();
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("external pruning preserves linked skills that another manager owns", () => {
    const home = mkdtempSync(join(tmpdir(), "managed-skills-home-"));
    const root = mkdtempSync(join(tmpdir(), "managed-skills-manifest-"));
    try {
      const manifestPath = writeExternalManifest(root, "source demo owner/demo allowlist keep\n");
      mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
      writeFileSync(
        join(home, ".intuitive-flow", "external-skills-demo.json"),
        JSON.stringify({ schemaVersion: 1, source: "owner/demo", skills: ["keep", "qa"] }),
      );
      mkdirSync(join(home, ".agents", "skills", "keep"), { recursive: true });
      mkdirSync(join(home, ".claude", "skills", "qa"), { recursive: true });
      mkdirSync(join(root, "gstack", "qa"), { recursive: true });
      writeFileSync(join(root, "gstack", "qa", "SKILL.md"), "# GStack QA\n");
      symlinkSync(join(root, "gstack", "qa", "SKILL.md"), join(home, ".claude", "skills", "qa", "SKILL.md"));
      writeFileSync(
        join(home, ".agents", ".skill-lock.json"),
        JSON.stringify({
          skills: {
            keep: { source: "owner/demo" },
            qa: { source: "owner/demo" },
          },
        }),
      );

      const removed = syncExternalSkillState(manifestPath, "demo", home);

      expect(removed).toBe(0);
      expect(existsSync(join(home, ".claude", "skills", "qa", "SKILL.md"))).toBe(true);
      expect(JSON.parse(readFileSync(join(home, ".agents", ".skill-lock.json"), "utf8")).skills.qa).toBeUndefined();
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("records full external source installs from the skills lock without pruning on first run", () => {
    const home = mkdtempSync(join(tmpdir(), "managed-skills-home-"));
    const root = mkdtempSync(join(tmpdir(), "managed-skills-manifest-"));
    try {
      const manifestPath = writeExternalManifest(root, "source demo https://github.com/owner/demo.git all\n");
      mkdirSync(join(home, ".agents"), { recursive: true });
      writeFileSync(
        join(home, ".agents", ".skill-lock.json"),
        JSON.stringify({
          skills: {
            alpha: { source: "owner/demo" },
            beta: { source: "https://github.com/owner/demo.git" },
            other: { source: "someone/else" },
          },
        }),
      );

      const removed = syncExternalSkillState(manifestPath, "demo", home);

      expect(removed).toBe(0);
      expect(JSON.parse(readFileSync(join(home, ".intuitive-flow", "external-skills-demo.json"), "utf8"))).toEqual({
        schemaVersion: 1,
        source: "owner/demo",
        skills: ["alpha", "beta"],
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("full external source sync does not prune when the skills lock has no source evidence", () => {
    const home = mkdtempSync(join(tmpdir(), "managed-skills-home-"));
    const root = mkdtempSync(join(tmpdir(), "managed-skills-manifest-"));
    try {
      const manifestPath = writeExternalManifest(root, "source demo owner/demo all\n");
      mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
      writeFileSync(
        join(home, ".intuitive-flow", "external-skills-demo.json"),
        JSON.stringify({ schemaVersion: 1, source: "owner/demo", skills: ["alpha"] }),
      );
      mkdirSync(join(home, ".agents", "skills", "alpha"), { recursive: true });
      writeFileSync(join(home, ".agents", ".skill-lock.json"), JSON.stringify({ skills: {} }));

      const removed = syncExternalSkillState(manifestPath, "demo", home);

      expect(removed).toBe(0);
      expect(existsSync(join(home, ".agents", "skills", "alpha"))).toBe(true);
      expect(JSON.parse(readFileSync(join(home, ".intuitive-flow", "external-skills-demo.json"), "utf8"))).toEqual({
        schemaVersion: 1,
        source: "owner/demo",
        skills: ["alpha"],
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("update wrappers call managed skill state after installs", () => {
    const updateGstack = readFileSync(join(repoRoot, "scripts", "tasks", "update-gstack.sh"), "utf8");
    const updateSkills = readFileSync(join(repoRoot, "scripts", "tasks", "update-skills.sh"), "utf8");

    expect(updateGstack).toContain('managed-skill-state.ts" "$@"');
    expect(updateGstack).toContain('gstack-sync "$repo_dir"');
    expect(updateSkills).toContain('managed-skill-state.ts" "$@"');
    expect(updateSkills).toContain('external-sync "$manifest" "$label"');
  });
});
