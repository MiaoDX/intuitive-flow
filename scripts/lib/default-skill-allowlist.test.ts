import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkRootSkills,
  readDefaultSkillAllowlist,
  parseDefaultSkillAllowlistText,
  pruneLegacyArtifacts,
  pruneRemovedOwnedRootSkills,
  recordOwnedRootSkills,
} from "./default-skill-allowlist";

describe("default skill allowlist", () => {
  test("parses root, external, GStack, GSD, and legacy entries", () => {
    const allowlist = parseDefaultSkillAllowlistText(`
      # comment
      root-skill intuitive-flow
      root-skill intuitive-flow
      root-skill agent-planning-loop
      external-skill mattpocock https://github.com/mattpocock/skills handoff
      external-skill mattpocock https://github.com/mattpocock/skills tdd
      gstack-skill gstack-review
      gsd-skill gsd-plan-phase
      legacy-skill intuitive-planning-loop
      legacy-skill old-flow
      legacy-command old.md
      legacy-mimocode-command stale.md
    `);

    expect(allowlist.rootSkills).toEqual(["agent-planning-loop", "intuitive-flow"]);
    expect(allowlist.externalSources).toEqual([
      {
        label: "mattpocock",
        repo: "https://github.com/mattpocock/skills",
        skills: ["handoff", "tdd"],
      },
    ]);
    expect(allowlist.gstackSkills).toEqual(["gstack-review"]);
    expect(allowlist.gsdSkills).toEqual(["gsd-plan-phase"]);
    expect(allowlist.legacySkills).toEqual(["intuitive-planning-loop", "old-flow"]);
    expect(allowlist.legacyCommands).toEqual(["old.md"]);
    expect(allowlist.legacyMimocodeCommands).toEqual(["stale.md"]);
  });

  test("current default surface keeps debugging and GSD visibility narrow", () => {
    const allowlist = readDefaultSkillAllowlist(join(process.cwd(), "scripts", "default-skill-allowlist.txt"));
    const externalSkills = allowlist.externalSources.flatMap((source) => source.skills);

    expect(externalSkills).not.toContain("diagnose");
    expect(allowlist.gstackSkills).toContain("gstack-investigate");
    expect(allowlist.gsdSkills).toEqual(["gsd-pause-work", "gsd-progress", "gsd-resume-work"]);
  });

  test("rejects unsafe values and duplicate labels pointing at different repos", () => {
    expect(() => parseDefaultSkillAllowlistText("legacy-skill ../not-owned")).toThrow("unsafe skill name");
    expect(() =>
      parseDefaultSkillAllowlistText(`
        external-skill demo owner/one alpha
        external-skill demo owner/two beta
      `),
    ).toThrow("external skill source label maps to multiple repos");
  });

  test("rejects entries that are both current and legacy", () => {
    expect(() =>
      parseDefaultSkillAllowlistText(`
        root-skill intuitive-flow
        legacy-skill intuitive-flow
      `),
    ).toThrow("skill listed as both current and legacy: intuitive-flow");

    expect(() =>
      parseDefaultSkillAllowlistText(`
        gstack-skill gstack-review
        legacy-mimocode-command gstack-review.md
      `),
    ).toThrow("command listed as both current and legacy: gstack-review.md");
  });

  test("checks root skill folders against the allowlist", () => {
    const root = mkdtempSync(join(tmpdir(), "root-skills-"));
    try {
      mkdirSync(join(root, "listed"), { recursive: true });
      writeFileSync(join(root, "listed", "SKILL.md"), "");
      mkdirSync(join(root, "unlisted"), { recursive: true });
      writeFileSync(join(root, "unlisted", "SKILL.md"), "");

      const errors = checkRootSkills(parseDefaultSkillAllowlistText("root-skill listed\nroot-skill missing\n"), root);

      expect(errors).toContain("default allowlist lists missing root skill: missing");
      expect(errors).toContain("root skill missing from default allowlist: unlisted");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("prunes only allowlist legacy artifacts", () => {
    const home = mkdtempSync(join(tmpdir(), "skill-home-"));
    try {
      mkdirSync(join(home, ".codex", "skills", "old-skill"), { recursive: true });
      mkdirSync(join(home, ".codex", "skills", "keep-skill"), { recursive: true });
      mkdirSync(join(home, ".claude", "commands"), { recursive: true });
      writeFileSync(join(home, ".claude", "commands", "old.md"), "");
      mkdirSync(join(home, ".config", "mimocode", "command"), { recursive: true });
      writeFileSync(join(home, ".config", "mimocode", "command", "stale.md"), "");
      writeFileSync(join(home, ".config", "mimocode", "command", "old-skill.md"), "");
      writeFileSync(join(home, ".config", "mimocode", "command", "keep.md"), "");

      const removed = pruneLegacyArtifacts(
        parseDefaultSkillAllowlistText("legacy-skill old-skill\nlegacy-command old.md\nlegacy-mimocode-command stale.md\n"),
        home,
      );

      expect(removed).toBe(4);
      expect(existsSync(join(home, ".codex", "skills", "old-skill"))).toBe(false);
      expect(existsSync(join(home, ".claude", "commands", "old.md"))).toBe(false);
      expect(existsSync(join(home, ".config", "mimocode", "command", "stale.md"))).toBe(false);
      expect(existsSync(join(home, ".config", "mimocode", "command", "old-skill.md"))).toBe(false);
      expect(existsSync(join(home, ".config", "mimocode", "command", "keep.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "keep-skill"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("prunes only previously owned root skills missing from the allowlist", () => {
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

      const removed = pruneRemovedOwnedRootSkills(parseDefaultSkillAllowlistText("root-skill current\n"), home);

      expect(removed).toBe(2);
      expect(existsSync(join(home, ".codex", "skills", "current"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "removed"))).toBe(false);
      expect(existsSync(join(home, ".agents", "skills", "removed"))).toBe(false);
      expect(existsSync(join(home, ".codex", "skills", "user-skill"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("treats renamed planning loop as current root and old name as legacy cleanup", () => {
    const home = mkdtempSync(join(tmpdir(), "skill-home-"));
    try {
      mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
      writeFileSync(
        join(home, ".intuitive-flow", "owned-root-skills.json"),
        JSON.stringify({ schemaVersion: 1, rootSkills: ["agent-planning-loop", "intuitive-planning-loop"] }),
      );
      mkdirSync(join(home, ".codex", "skills", "agent-planning-loop"), { recursive: true });
      mkdirSync(join(home, ".codex", "skills", "intuitive-planning-loop"), { recursive: true });
      mkdirSync(join(home, ".agents", "skills", "intuitive-planning-loop"), { recursive: true });
      mkdirSync(join(home, ".claude", "skills", "intuitive-planning-loop"), { recursive: true });
      mkdirSync(join(home, ".config", "mimocode", "command"), { recursive: true });
      writeFileSync(join(home, ".config", "mimocode", "command", "intuitive-planning-loop.md"), "");

      const allowlist = parseDefaultSkillAllowlistText(`
        root-skill agent-planning-loop
        legacy-skill intuitive-planning-loop
      `);

      expect(pruneRemovedOwnedRootSkills(allowlist, home)).toBe(3);
      expect(pruneLegacyArtifacts(allowlist, home)).toBe(1);
      expect(existsSync(join(home, ".codex", "skills", "agent-planning-loop"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "intuitive-planning-loop"))).toBe(false);
      expect(existsSync(join(home, ".agents", "skills", "intuitive-planning-loop"))).toBe(false);
      expect(existsSync(join(home, ".claude", "skills", "intuitive-planning-loop"))).toBe(false);
      expect(existsSync(join(home, ".config", "mimocode", "command", "intuitive-planning-loop.md"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("flags the legacy planning loop if it remains as a repo root skill", () => {
    const root = mkdtempSync(join(tmpdir(), "root-skills-"));
    try {
      mkdirSync(join(root, "agent-planning-loop"), { recursive: true });
      writeFileSync(join(root, "agent-planning-loop", "SKILL.md"), "");
      mkdirSync(join(root, "intuitive-planning-loop"), { recursive: true });
      writeFileSync(join(root, "intuitive-planning-loop", "SKILL.md"), "");

      const errors = checkRootSkills(
        parseDefaultSkillAllowlistText(`
          root-skill agent-planning-loop
          legacy-skill intuitive-planning-loop
        `),
        root,
      );

      expect(errors).toEqual(["root skill missing from default allowlist: intuitive-planning-loop"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("records current root skills as owned state", () => {
    const home = mkdtempSync(join(tmpdir(), "skill-home-"));
    try {
      const allowlist = parseDefaultSkillAllowlistText("root-skill intuitive-flow\nroot-skill intuitive-doc\n");

      recordOwnedRootSkills(allowlist, home);

      const state = JSON.parse(readFileSync(join(home, ".intuitive-flow", "owned-root-skills.json"), "utf8"));
      expect(state).toEqual({
        schemaVersion: 1,
        rootSkills: ["intuitive-doc", "intuitive-flow"],
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
