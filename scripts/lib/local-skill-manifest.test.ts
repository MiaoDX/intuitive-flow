import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkRootSkills,
  parseManifestText,
  pruneLegacyArtifacts,
  pruneRemovedOwnedRootSkills,
  recordOwnedRootSkills,
} from "./local-skill-manifest";

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

  test("does not prune root skills before owned state exists", () => {
    const home = mkdtempSync(join(tmpdir(), "skill-home-"));
    try {
      mkdirSync(join(home, ".codex", "skills", "old-owned"), { recursive: true });

      const removed = pruneRemovedOwnedRootSkills(parseManifestText("root-skill current\n"), home);

      expect(removed).toBe(0);
      expect(existsSync(join(home, ".codex", "skills", "old-owned"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("prunes only previously owned root skills missing from the current manifest", () => {
    const home = mkdtempSync(join(tmpdir(), "skill-home-"));
    try {
      mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
      writeFileSync(
        join(home, ".intuitive-flow", "owned-root-skills.json"),
        JSON.stringify({ schemaVersion: 1, rootSkills: ["current", "removed", "../unsafe"] }),
      );
      mkdirSync(join(home, ".codex", "skills", "current"), { recursive: true });
      mkdirSync(join(home, ".codex", "skills", "removed"), { recursive: true });
      mkdirSync(join(home, ".agents", "skills", "removed"), { recursive: true });
      mkdirSync(join(home, ".codex", "skills", "user-skill"), { recursive: true });

      const removed = pruneRemovedOwnedRootSkills(parseManifestText("root-skill current\n"), home);

      expect(removed).toBe(2);
      expect(existsSync(join(home, ".codex", "skills", "current"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "removed"))).toBe(false);
      expect(existsSync(join(home, ".agents", "skills", "removed"))).toBe(false);
      expect(existsSync(join(home, ".codex", "skills", "user-skill"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("records current root skills as owned state", () => {
    const home = mkdtempSync(join(tmpdir(), "skill-home-"));
    try {
      const manifest = parseManifestText("root-skill intuitive-flow\nroot-skill intuitive-doc\n");

      recordOwnedRootSkills(manifest, home);

      const state = JSON.parse(readFileSync(join(home, ".intuitive-flow", "owned-root-skills.json"), "utf8"));
      expect(state).toEqual({
        schemaVersion: 1,
        rootSkills: ["intuitive-flow", "intuitive-doc"],
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
