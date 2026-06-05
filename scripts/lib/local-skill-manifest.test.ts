import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkRootSkills, parseManifestText, pruneLegacyArtifacts } from "./local-skill-manifest";

describe("local skill manifest", () => {
  test("parses supported entries and deduplicates repeats", () => {
    const manifest = parseManifestText(`
      # comment
      root-skill intuitive-flow
      root-skill intuitive-flow
      legacy-skill old-flow
      legacy-command old.md
      legacy-mimocode-command stale.md
    `);

    expect(manifest.rootSkills).toEqual(["intuitive-flow"]);
    expect(manifest.legacySkills).toEqual(["old-flow"]);
    expect(manifest.legacyCommands).toEqual(["old.md"]);
    expect(manifest.legacyMimocodeCommands).toEqual(["stale.md"]);
  });

  test("rejects path-like values", () => {
    expect(() => parseManifestText("legacy-skill ../not-owned")).toThrow("unsafe manifest value");
  });

  test("checks manifest against root skill folders", () => {
    const root = mkdtempSync(join(tmpdir(), "root-skills-"));
    try {
      mkdirSync(join(root, "listed"), { recursive: true });
      writeFileSync(join(root, "listed", "SKILL.md"), "");
      mkdirSync(join(root, "unlisted"), { recursive: true });
      writeFileSync(join(root, "unlisted", "SKILL.md"), "");

      const errors = checkRootSkills(parseManifestText("root-skill listed\nroot-skill missing\n"), root);

      expect(errors).toContain("manifest lists missing root skill: missing");
      expect(errors).toContain("root skill missing from manifest: unlisted");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("prunes only manifest-listed legacy artifacts", () => {
    const home = mkdtempSync(join(tmpdir(), "skill-home-"));
    try {
      mkdirSync(join(home, ".codex", "skills", "old-skill"), { recursive: true });
      mkdirSync(join(home, ".codex", "skills", "keep-skill"), { recursive: true });
      mkdirSync(join(home, ".claude", "commands"), { recursive: true });
      writeFileSync(join(home, ".claude", "commands", "old.md"), "");
      mkdirSync(join(home, ".config", "mimocode", "command"), { recursive: true });
      writeFileSync(join(home, ".config", "mimocode", "command", "stale.md"), "");
      writeFileSync(join(home, ".config", "mimocode", "command", "keep.md"), "");

      const removed = pruneLegacyArtifacts(parseManifestText("legacy-skill old-skill\nlegacy-command old.md\nlegacy-mimocode-command stale.md\n"), home);

      expect(removed).toBe(3);
      expect(existsSync(join(home, ".codex", "skills", "old-skill"))).toBe(false);
      expect(existsSync(join(home, ".claude", "commands", "old.md"))).toBe(false);
      expect(existsSync(join(home, ".config", "mimocode", "command", "stale.md"))).toBe(false);
      expect(existsSync(join(home, ".config", "mimocode", "command", "keep.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "keep-skill"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
