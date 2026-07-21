import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkRootSkills,
  externalSourcesForInstall,
  gsdSkillsForInstall,
  hostScopedExternalSkillsForInstall,
  readDefaultSkillAllowlist,
  rootSkillsForInstall,
  parseDefaultSkillAllowlistText,
  parsePruneLedgerText,
} from "./default-skill-allowlist";

describe("default skill allowlist", () => {
  test("parses root, external, GStack, and GSD install entries", () => {
    const allowlist = parseDefaultSkillAllowlistText(`
      # comment
      root-skill default intuitive-flow
      root-skill default intuitive-flow
      root-skill routed agent-planning-loop
      external-skill on-demand all mattpocock https://github.com/mattpocock/skills handoff
      external-skill routed all mattpocock https://github.com/mattpocock/skills tdd
      gstack-skill default gstack-review
      gsd-skill on-demand gsd-plan-phase
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
    expect(rootSkillsForInstall(allowlist)).toEqual(["agent-planning-loop", "intuitive-flow"]);
    expect(externalSourcesForInstall(allowlist).flatMap((source) => source.skills)).toEqual(["tdd"]);
    expect(gsdSkillsForInstall(allowlist)).toEqual([]);
  });

  test("parses prune-only legacy entries separately from the install allowlist", () => {
    const ledger = parsePruneLedgerText(`
      # comment
      legacy-skill old-alpha
      legacy-skill old-flow
      legacy-skill old-flow
      legacy-command old.md
    `);

    expect(ledger.legacySkills).toEqual(["old-alpha", "old-flow"]);
    expect(ledger.legacyCommands).toEqual(["old.md"]);
  });

  test("current default surface keeps debugging and GSD visibility narrow", () => {
    const allowlist = readDefaultSkillAllowlist(join(process.cwd(), "scripts", "default-skill-allowlist.txt"));
    const externalSkills = allowlist.externalSources.flatMap((source) => source.skills);

    expect(externalSkills).not.toContain("diagnose");
    expect(allowlist.gstackSkills).toContain("gstack-investigate");
    expect(gsdSkillsForInstall(allowlist)).toEqual([]);
  });

  test("current portfolio routes only the useful ponytail review skills by default", () => {
    const allowlist = readDefaultSkillAllowlist(join(process.cwd(), "scripts", "default-skill-allowlist.txt"));
    const ponytail = allowlist.externalSources.find((source) => source.label === "ponytail");

    expect(ponytail).toEqual({
      label: "ponytail",
      repo: "https://github.com/DietrichGebert/ponytail",
      skills: ["ponytail", "ponytail-audit", "ponytail-debt", "ponytail-help", "ponytail-review"],
    });
    expect(externalSourcesForInstall(allowlist).find((source) => source.label === "ponytail")?.skills)
      .toEqual(["ponytail-audit", "ponytail-review"]);
  });

  test("keeps repo-owned research available without default installation", () => {
    const previous = process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS;
    try {
      delete process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS;
      const allowlist = readDefaultSkillAllowlist(join(process.cwd(), "scripts", "default-skill-allowlist.txt"));

      expect(allowlist.rootSkillPolicies).toContainEqual({ skill: "research", tier: "on-demand" });
      expect(rootSkillsForInstall(allowlist)).not.toContain("research");

      process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS = "research";
      expect(rootSkillsForInstall(allowlist)).toContain("research");
    } finally {
      if (previous === undefined) delete process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS;
      else process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS = previous;
    }
  });

  test("selects registered on-demand skills and filters external skills by host", () => {
    const previous = process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS;
    try {
      process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS = "skill-creator,gsd-progress";
      const allowlist = readDefaultSkillAllowlist(join(process.cwd(), "scripts", "default-skill-allowlist.txt"));

      expect(gsdSkillsForInstall(allowlist)).toEqual(["gsd-progress"]);
      expect(externalSourcesForInstall(allowlist, "claude-code").flatMap((source) => source.skills))
        .toContain("skill-creator");
      expect(externalSourcesForInstall(allowlist, "codex").flatMap((source) => source.skills))
        .not.toContain("skill-creator");
      expect(hostScopedExternalSkillsForInstall(allowlist, "anthropics", "claude-code"))
        .toEqual(["skill-creator"]);
    } finally {
      if (previous === undefined) delete process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS;
      else process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS = previous;
    }
  });

  test("rejects unknown on-demand skill selections", () => {
    const previous = process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS;
    try {
      process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS = "not-registered";
      const allowlist = readDefaultSkillAllowlist(join(process.cwd(), "scripts", "default-skill-allowlist.txt"));
      expect(() => rootSkillsForInstall(allowlist)).toThrow("unknown on-demand skill");
    } finally {
      if (previous === undefined) delete process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS;
      else process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS = previous;
    }
  });

  test("rejects unsafe values and duplicate labels pointing at different repos", () => {
    expect(() => parsePruneLedgerText("legacy-skill ../not-owned")).toThrow("unsafe skill name");
    expect(() =>
      parseDefaultSkillAllowlistText(`
        external-skill default all demo owner/one alpha
        external-skill default all demo owner/two beta
      `),
    ).toThrow("external skill source label maps to multiple repos");
  });

  test("rejects managed skill name collisions across sources", () => {
    expect(() => parseDefaultSkillAllowlistText(`
      root-skill default shared-name
      external-skill routed all demo owner/demo shared-name
    `)).toThrow("managed skill name collision");
  });

  test("rejects prune-only entries in the install allowlist and install entries in the prune ledger", () => {
    expect(() => parseDefaultSkillAllowlistText("legacy-skill old-flow\n")).toThrow(
      "default skill allowlist must not contain prune-only legacy entries",
    );
    expect(() => parseDefaultSkillAllowlistText("legacy-command old.md\n")).toThrow(
      "default skill allowlist must not contain prune-only legacy entries",
    );
    expect(() => parsePruneLedgerText("root-skill default intuitive-flow\n")).toThrow(
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

      const errors = checkRootSkills(parseDefaultSkillAllowlistText("root-skill default listed\nroot-skill on-demand missing\n"), root);

      expect(errors).toContain("default allowlist lists missing root skill: missing");
      expect(errors).toContain("root skill missing from default allowlist: unlisted");
    } finally {
      rmSync(root, { recursive: true, force: true });
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
        parseDefaultSkillAllowlistText("root-skill default current\n"),
        root,
      );

      expect(errors).toEqual(["root skill missing from default allowlist: legacy-local"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

});
