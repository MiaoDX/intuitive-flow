import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  pruneLegacyArtifacts,
  pruneRemovedOwnedRootSkills,
  pruneRemovedExternalSkillStates,
  recordOwnedRootSkills,
  syncExternalSkillState,
  syncGsdSkillState,
  syncGstackSkillState,
} from "./managed-skill-state";

const repoRoot = process.cwd();

const writeAllowlist = (root: string, text: string) => {
  const allowlistPath = join(root, "default-skill-allowlist.txt");
  writeFileSync(allowlistPath, text);
  return allowlistPath;
};

const activeShell = (script: string) =>
  script
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

const expectManagedStateCommand = (script: string, command: string) => {
  const commandLine = activeShell(script).find((line) => line.includes(`managed-skill-state.ts" ${command}`));
  expect(commandLine).toBeDefined();
  expect(commandLine).toContain("bun ");
};

const expectManagedStateToolCall = (script: string, command: string, arg: string) => {
  expect(activeShell(script)).toContain(`_managed_state_tool ${command} "${arg}" || return 1`);
};

describe("managed skill state", () => {
  test("prunes only prune-ledger legacy artifacts", () => {
    const home = mkdtempSync(join(tmpdir(), "skill-home-"));
    const root = mkdtempSync(join(tmpdir(), "skill-prune-ledger-"));
    try {
      const pruneLedgerPath = join(root, "default-skill-prune-ledger.txt");
      writeFileSync(pruneLedgerPath, "legacy-skill old-skill\nlegacy-command old.md\nlegacy-mimocode-command stale.md\n");
      mkdirSync(join(home, ".codex", "skills", "old-skill"), { recursive: true });
      mkdirSync(join(home, ".codex", "skills", "keep-skill"), { recursive: true });
      mkdirSync(join(home, ".claude", "commands"), { recursive: true });
      writeFileSync(join(home, ".claude", "commands", "old.md"), "");
      mkdirSync(join(home, ".config", "mimocode", "command"), { recursive: true });
      writeFileSync(join(home, ".config", "mimocode", "command", "stale.md"), "");
      writeFileSync(join(home, ".config", "mimocode", "command", "old-skill.md"), "");
      writeFileSync(join(home, ".config", "mimocode", "command", "keep.md"), "");

      const removed = pruneLegacyArtifacts(pruneLedgerPath, home);

      expect(removed).toBe(4);
      expect(existsSync(join(home, ".codex", "skills", "old-skill"))).toBe(false);
      expect(existsSync(join(home, ".claude", "commands", "old.md"))).toBe(false);
      expect(existsSync(join(home, ".config", "mimocode", "command", "stale.md"))).toBe(false);
      expect(existsSync(join(home, ".config", "mimocode", "command", "old-skill.md"))).toBe(false);
      expect(existsSync(join(home, ".config", "mimocode", "command", "keep.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "keep-skill"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("prunes only previously owned root skills missing from the allowlist", () => {
    const home = mkdtempSync(join(tmpdir(), "skill-home-"));
    const root = mkdtempSync(join(tmpdir(), "skill-allowlist-"));
    try {
      const allowlistPath = writeAllowlist(root, "root-skill current\n");
      mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
      writeFileSync(
        join(home, ".intuitive-flow", "owned-root-skills.json"),
        JSON.stringify({ schemaVersion: 1, rootSkills: ["current", "removed", "../unsafe"] }),
      );
      mkdirSync(join(home, ".codex", "skills", "current"), { recursive: true });
      mkdirSync(join(home, ".codex", "skills", "removed"), { recursive: true });
      mkdirSync(join(home, ".agents", "skills", "removed"), { recursive: true });
      mkdirSync(join(home, ".codex", "skills", "user-skill"), { recursive: true });

      const removed = pruneRemovedOwnedRootSkills(allowlistPath, home);

      expect(removed).toBe(2);
      expect(existsSync(join(home, ".codex", "skills", "current"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "removed"))).toBe(false);
      expect(existsSync(join(home, ".agents", "skills", "removed"))).toBe(false);
      expect(existsSync(join(home, ".codex", "skills", "user-skill"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("records current root skills as owned state", () => {
    const home = mkdtempSync(join(tmpdir(), "skill-home-"));
    const root = mkdtempSync(join(tmpdir(), "skill-allowlist-"));
    try {
      const allowlistPath = writeAllowlist(root, "root-skill intuitive-flow\nroot-skill intuitive-doc\n");

      recordOwnedRootSkills(allowlistPath, home);

      const state = JSON.parse(readFileSync(join(home, ".intuitive-flow", "owned-root-skills.json"), "utf8"));
      expect(state).toEqual({
        schemaVersion: 1,
        rootSkills: ["intuitive-doc", "intuitive-flow"],
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("seeds gstack Codex state without deleting before prior ownership exists", () => {
    const home = mkdtempSync(join(tmpdir(), "managed-skills-home-"));
    const repo = mkdtempSync(join(tmpdir(), "managed-skills-gstack-"));
    try {
      mkdirSync(join(repo, ".agents", "skills", "gstack-review"), { recursive: true });
      writeFileSync(join(repo, ".agents", "skills", "gstack-review", "SKILL.md"), "# Review\n");
      mkdirSync(join(home, ".codex", "skills", "gstack-stale"), { recursive: true });
      writeFileSync(join(home, ".codex", "skills", "gstack-stale", "SKILL.md"), "# User stale-looking skill\n");
      const allowlistPath = writeAllowlist(repo, "gstack-skill gstack-review\n");

      const removed = syncGstackSkillState(repo, allowlistPath, home);

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
      const allowlistPath = writeAllowlist(repo, "gstack-skill gstack-review\ngstack-skill gstack-old\n");

      expect(syncGstackSkillState(repo, allowlistPath, home, join(home, ".codex"))).toBe(0);
      rmSync(join(repo, ".agents", "skills", "gstack-old"), { recursive: true, force: true });

      const removed = syncGstackSkillState(repo, allowlistPath, home, join(home, ".codex"));

      expect(removed).toBe(1);
      expect(existsSync(join(home, ".codex", "skills", "gstack-review", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "gstack-old"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("gstack sync prunes owned Codex and Claude skills outside the allowlist", () => {
    const home = mkdtempSync(join(tmpdir(), "managed-skills-home-"));
    const repo = mkdtempSync(join(tmpdir(), "managed-skills-gstack-"));
    try {
      for (const skillName of ["gstack-review", "gstack-benchmark", "gstack-plan-eng-review", "gstack-qa"]) {
        mkdirSync(join(repo, ".agents", "skills", skillName), { recursive: true });
        writeFileSync(join(repo, ".agents", "skills", skillName, "SKILL.md"), `---\nname: ${skillName}\ndescription: ${skillName}.\n---\n`);
      }
      for (const skillName of ["review", "benchmark", "plan-eng-review", "qa"]) {
        mkdirSync(join(repo, skillName), { recursive: true });
        writeFileSync(join(repo, skillName, "SKILL.md"), `---\nname: ${skillName}\ndescription: ${skillName}.\n---\n`);
      }
      mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
      writeFileSync(
        join(home, ".intuitive-flow", "gstack-codex-skills.json"),
        JSON.stringify({
          schemaVersion: 1,
          source: "garrytan/gstack",
          skills: ["gstack-review", "gstack-benchmark", "gstack-plan-eng-review", "gstack-qa"],
        }),
      );
      writeFileSync(
        join(home, ".intuitive-flow", "gstack-claude-skills.json"),
        JSON.stringify({ schemaVersion: 1, source: "garrytan/gstack", skills: ["review", "benchmark", "plan-eng-review", "qa"] }),
      );
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      symlinkSync(join(repo, ".agents", "skills", "gstack-review"), join(home, ".codex", "skills", "gstack-review"));
      symlinkSync(join(repo, ".agents", "skills", "gstack-benchmark"), join(home, ".codex", "skills", "gstack-benchmark"));
      symlinkSync(join(repo, ".agents", "skills", "gstack-plan-eng-review"), join(home, ".codex", "skills", "gstack-plan-eng-review"));
      symlinkSync(join(repo, ".agents", "skills", "gstack-qa"), join(home, ".codex", "skills", "gstack-qa"));
      mkdirSync(join(home, ".claude", "skills", "review"), { recursive: true });
      mkdirSync(join(home, ".claude", "skills", "benchmark"), { recursive: true });
      mkdirSync(join(home, ".claude", "skills", "plan-eng-review"), { recursive: true });
      mkdirSync(join(home, ".claude", "skills", "qa"), { recursive: true });
      symlinkSync(join(repo, "review", "SKILL.md"), join(home, ".claude", "skills", "review", "SKILL.md"));
      symlinkSync(join(repo, "benchmark", "SKILL.md"), join(home, ".claude", "skills", "benchmark", "SKILL.md"));
      symlinkSync(join(repo, "plan-eng-review", "SKILL.md"), join(home, ".claude", "skills", "plan-eng-review", "SKILL.md"));
      symlinkSync(join(repo, "qa", "SKILL.md"), join(home, ".claude", "skills", "qa", "SKILL.md"));
      const allowlistPath = writeAllowlist(
        repo,
        "gstack-skill gstack-review\ngstack-skill gstack-plan-eng-review\ngstack-skill gstack-qa\n",
      );

      const removed = syncGstackSkillState(repo, allowlistPath, home);

      expect(removed).toBe(2);
      expect(existsSync(join(home, ".codex", "skills", "gstack-review", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "gstack-plan-eng-review", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "gstack-qa", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "gstack-benchmark"))).toBe(false);
      expect(existsSync(join(home, ".claude", "skills", "review", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".claude", "skills", "plan-eng-review", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".claude", "skills", "qa", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".claude", "skills", "benchmark"))).toBe(false);
      expect(JSON.parse(readFileSync(join(home, ".intuitive-flow", "gstack-codex-skills.json"), "utf8")).skills).toEqual([
        "gstack-plan-eng-review",
        "gstack-qa",
        "gstack-review",
      ]);
      expect(JSON.parse(readFileSync(join(home, ".intuitive-flow", "gstack-claude-skills.json"), "utf8")).skills).toEqual([
        "_gstack-command",
        "gstack",
        "plan-eng-review",
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
    const root = mkdtempSync(join(tmpdir(), "managed-skills-allowlist-"));
    try {
      const allowlistPath = writeAllowlist(root, "external-skill demo owner/demo keep\n");
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

      const removed = syncExternalSkillState(allowlistPath, "demo", home);

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
    const root = mkdtempSync(join(tmpdir(), "managed-skills-allowlist-"));
    try {
      const allowlistPath = writeAllowlist(root, "external-skill demo owner/demo keep\n");
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

      const removed = syncExternalSkillState(allowlistPath, "demo", home);

      expect(removed).toBe(0);
      expect(existsSync(join(home, ".claude", "skills", "qa", "SKILL.md"))).toBe(true);
      expect(JSON.parse(readFileSync(join(home, ".agents", ".skill-lock.json"), "utf8")).skills.qa).toBeUndefined();
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("prunes removed external source labels from prior owned state", () => {
    const home = mkdtempSync(join(tmpdir(), "managed-skills-home-"));
    const root = mkdtempSync(join(tmpdir(), "managed-skills-allowlist-"));
    try {
      const allowlistPath = writeAllowlist(root, "external-skill keep owner/keep alpha\n");
      mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
      writeFileSync(
        join(home, ".intuitive-flow", "external-skills-removed.json"),
        JSON.stringify({ schemaVersion: 1, source: "owner/removed", skills: ["old"] }),
      );
      writeFileSync(
        join(home, ".intuitive-flow", "external-skills-keep.json"),
        JSON.stringify({ schemaVersion: 1, source: "owner/keep", skills: ["alpha"] }),
      );
      mkdirSync(join(home, ".agents", "skills", "old"), { recursive: true });
      mkdirSync(join(home, ".agents", "skills", "alpha"), { recursive: true });
      mkdirSync(join(home, ".agents"), { recursive: true });
      writeFileSync(
        join(home, ".agents", ".skill-lock.json"),
        JSON.stringify({
          skills: {
            old: { source: "owner/removed" },
            alpha: { source: "owner/keep" },
          },
        }),
      );

      const removed = pruneRemovedExternalSkillStates(allowlistPath, home);

      expect(removed).toBe(2);
      expect(existsSync(join(home, ".agents", "skills", "old"))).toBe(false);
      expect(existsSync(join(home, ".agents", "skills", "alpha"))).toBe(true);
      expect(existsSync(join(home, ".intuitive-flow", "external-skills-removed.json"))).toBe(false);
      expect(existsSync(join(home, ".intuitive-flow", "external-skills-keep.json"))).toBe(true);
      expect(JSON.parse(readFileSync(join(home, ".agents", ".skill-lock.json"), "utf8"))).toEqual({
        skills: {
          alpha: { source: "owner/keep" },
        },
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("GSD sync prunes managed wrappers outside the allowlist", () => {
    const home = mkdtempSync(join(tmpdir(), "managed-skills-home-"));
    const root = mkdtempSync(join(tmpdir(), "managed-skills-allowlist-"));
    try {
      const allowlistPath = writeAllowlist(root, "gsd-skill gsd-plan-phase\n");
      mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
      writeFileSync(
        join(home, ".intuitive-flow", "gsd-skills.json"),
        JSON.stringify({ schemaVersion: 1, source: "opengsd/get-shit-done-redux", skills: ["gsd-plan-phase", "gsd-old"] }),
      );
      mkdirSync(join(home, ".codex", "skills", "gsd-plan-phase"), { recursive: true });
      writeFileSync(join(home, ".codex", "skills", "gsd-plan-phase", "SKILL.md"), "get-shit-done plan\n");
      mkdirSync(join(home, ".codex", "skills", "gsd-old"), { recursive: true });
      writeFileSync(join(home, ".codex", "skills", "gsd-old", "SKILL.md"), "get-shit-done old\n");
      mkdirSync(join(home, ".codex", "skills", "gsd-user"), { recursive: true });
      writeFileSync(join(home, ".codex", "skills", "gsd-user", "SKILL.md"), "# User skill\n");

      const removed = syncGsdSkillState(allowlistPath, home, join(home, ".codex"));

      expect(removed).toBe(1);
      expect(existsSync(join(home, ".codex", "skills", "gsd-plan-phase", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "gsd-old"))).toBe(false);
      expect(existsSync(join(home, ".codex", "skills", "gsd-user", "SKILL.md"))).toBe(true);
      expect(JSON.parse(readFileSync(join(home, ".intuitive-flow", "gsd-skills.json"), "utf8"))).toEqual({
        schemaVersion: 1,
        source: "opengsd/get-shit-done-redux",
        skills: ["gsd-plan-phase"],
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("update tasks run managed skill state after installs", () => {
    const updateGstack = readFileSync(join(repoRoot, "scripts", "tasks", "update-gstack.sh"), "utf8");
    const updateSkills = readFileSync(join(repoRoot, "scripts", "tasks", "update-skills.sh"), "utf8");
    const updateCli = readFileSync(join(repoRoot, "scripts", "tasks", "update-cli.sh"), "utf8");
    const syncLocal = readFileSync(join(repoRoot, "scripts", "tasks", "sync-local-commands-skills.sh"), "utf8");

    expectManagedStateCommand(updateGstack, "gstack-sync");
    expectManagedStateCommand(updateSkills, "external-sync");
    expectManagedStateCommand(updateSkills, "external-prune-removed");
    expectManagedStateCommand(updateCli, "gsd-sync");
    expectManagedStateToolCall(syncLocal, "prune-legacy-artifacts", "$default_skill_prune_ledger");
    expectManagedStateToolCall(syncLocal, "prune-owned-root-skills", "$default_skill_allowlist");
    expectManagedStateToolCall(syncLocal, "record-owned-root-skills", "$default_skill_allowlist");
  });
});
