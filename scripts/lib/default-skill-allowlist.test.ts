import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkRootSkills,
  readDefaultSkillAllowlist,
  parseDefaultSkillAllowlistText,
  parsePruneLedgerText,
  pruneLegacyArtifacts,
} from "./default-skill-allowlist";

describe("default skill allowlist", () => {
  test("parses root, external, GStack, and GSD install entries", () => {
    const allowlist = parseDefaultSkillAllowlistText(`
      # comment
      root-skill intuitive-flow
      root-skill intuitive-flow
      root-skill agent-planning-loop
      external-skill mattpocock https://github.com/mattpocock/skills handoff
      external-skill mattpocock https://github.com/mattpocock/skills tdd
      gstack-skill gstack-review
      gsd-skill gsd-plan-phase
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
  });

  test("parses prune-only legacy entries separately from the install allowlist", () => {
    const ledger = parsePruneLedgerText(`
      # comment
      legacy-skill old-alpha
      legacy-skill old-flow
      legacy-skill old-flow
      legacy-command old.md
      legacy-mimocode-command stale.md
    `);

    expect(ledger.legacySkills).toEqual(["old-alpha", "old-flow"]);
    expect(ledger.legacyCommands).toEqual(["old.md"]);
    expect(ledger.legacyMimocodeCommands).toEqual(["stale.md"]);
  });

  test("current default surface keeps debugging and GSD visibility narrow", () => {
    const allowlist = readDefaultSkillAllowlist(join(process.cwd(), "scripts", "default-skill-allowlist.txt"));
    const externalSkills = allowlist.externalSources.flatMap((source) => source.skills);

    expect(externalSkills).not.toContain("diagnose");
    expect(allowlist.gstackSkills).toContain("gstack-investigate");
    expect(allowlist.gsdSkills).toEqual(["gsd-pause-work", "gsd-progress", "gsd-resume-work"]);
  });

  test("current default surface installs ponytail trial skills explicitly", () => {
    const allowlist = readDefaultSkillAllowlist(join(process.cwd(), "scripts", "default-skill-allowlist.txt"));
    const ponytail = allowlist.externalSources.find((source) => source.label === "ponytail");

    expect(ponytail).toEqual({
      label: "ponytail",
      repo: "https://github.com/DietrichGebert/ponytail",
      skills: ["ponytail", "ponytail-audit", "ponytail-debt", "ponytail-help", "ponytail-review"],
    });
  });

  test("rejects unsafe values and duplicate labels pointing at different repos", () => {
    expect(() => parsePruneLedgerText("legacy-skill ../not-owned")).toThrow("unsafe skill name");
    expect(() =>
      parseDefaultSkillAllowlistText(`
        external-skill demo owner/one alpha
        external-skill demo owner/two beta
      `),
    ).toThrow("external skill source label maps to multiple repos");
  });

  test("rejects prune-only entries in the install allowlist and install entries in the prune ledger", () => {
    expect(() => parseDefaultSkillAllowlistText("legacy-skill old-flow\n")).toThrow(
      "default skill allowlist must not contain prune-only legacy entries",
    );
    expect(() => parseDefaultSkillAllowlistText("legacy-command old.md\n")).toThrow(
      "default skill allowlist must not contain prune-only legacy entries",
    );
    expect(() => parsePruneLedgerText("root-skill intuitive-flow\n")).toThrow(
      "default skill prune ledger must contain only legacy entries",
    );
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

  test("prunes only prune-ledger legacy artifacts", () => {
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
        parsePruneLedgerText("legacy-skill old-skill\nlegacy-command old.md\nlegacy-mimocode-command stale.md\n"),
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

  test("flags legacy skills if they remain as repo root skills", () => {
    const root = mkdtempSync(join(tmpdir(), "root-skills-"));
    try {
      mkdirSync(join(root, "current"), { recursive: true });
      writeFileSync(join(root, "current", "SKILL.md"), "");
      mkdirSync(join(root, "legacy-local"), { recursive: true });
      writeFileSync(join(root, "legacy-local", "SKILL.md"), "");

      const errors = checkRootSkills(
        parseDefaultSkillAllowlistText("root-skill current\n"),
        root,
      );

      expect(errors).toEqual(["root skill missing from default allowlist: legacy-local"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

});
