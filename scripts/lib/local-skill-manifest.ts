#!/usr/bin/env bun

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

type ManifestKind = "root-skill" | "legacy-skill" | "legacy-command" | "legacy-mimocode-command";

export type LocalSkillManifest = {
  rootSkills: string[];
  legacySkills: string[];
  legacyCommands: string[];
  legacyMimocodeCommands: string[];
};

type OwnedRootSkillState = {
  schemaVersion: 1;
  rootSkills: string[];
};

const kindToField: Record<ManifestKind, keyof LocalSkillManifest> = {
  "root-skill": "rootSkills",
  "legacy-skill": "legacySkills",
  "legacy-command": "legacyCommands",
  "legacy-mimocode-command": "legacyMimocodeCommands",
};

const skillInstallRoots = (home: string) => [
  join(home, ".codex", "skills"),
  join(home, ".agents", "skills"),
  join(home, ".claude", "skills"),
];

const ownedRootSkillsStatePath = (home: string) => join(home, ".intuitive-flow", "owned-root-skills.json");

const assertSafeName = (value: string, lineNumber: number) => {
  if (value.includes("/") || value.includes("\\") || value === "." || value === ".." || value.includes("..")) {
    throw new Error(`unsafe manifest value on line ${lineNumber}: ${value}`);
  }
};

const isSafeName = (value: string) => (
  !value.includes("/") && !value.includes("\\") && value !== "." && value !== ".." && !value.includes("..")
);

export const parseManifestText = (text: string): LocalSkillManifest => {
  const manifest: LocalSkillManifest = {
    rootSkills: [],
    legacySkills: [],
    legacyCommands: [],
    legacyMimocodeCommands: [],
  };
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      return;
    }

    const parts = line.split(/\s+/);
    if (parts.length !== 2) {
      throw new Error(`invalid manifest line ${lineNumber}: ${rawLine}`);
    }

    const [kind, value] = parts as [string, string];
    if (!(kind in kindToField)) {
      throw new Error(`unknown manifest kind on line ${lineNumber}: ${kind}`);
    }

    assertSafeName(value, lineNumber);

    const key = `${kind}:${value}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    manifest[kindToField[kind as ManifestKind]].push(value);
  });

  return manifest;
};

export const readManifest = async (manifestPath: string): Promise<LocalSkillManifest> => {
  if (!existsSync(manifestPath)) {
    throw new Error(`missing local skill manifest: ${manifestPath}`);
  }

  return parseManifestText(await Bun.file(manifestPath).text());
};

export const checkRootSkills = (manifest: LocalSkillManifest, rootSkillsDir: string): string[] => {
  const errors: string[] = [];
  const listed = new Set(manifest.rootSkills);

  for (const skillName of manifest.rootSkills) {
    if (!existsSync(join(rootSkillsDir, skillName, "SKILL.md"))) {
      errors.push(`manifest lists missing root skill: ${skillName}`);
    }
  }

  if (existsSync(rootSkillsDir)) {
    for (const entry of readdirSync(rootSkillsDir)) {
      const skillDir = join(rootSkillsDir, entry);
      if (statSync(skillDir).isDirectory() && existsSync(join(skillDir, "SKILL.md")) && !listed.has(entry)) {
        errors.push(`root skill missing from manifest: ${entry}`);
      }
    }
  }

  return errors;
};

export const pruneLegacyArtifacts = (
  manifest: LocalSkillManifest,
  home = process.env.HOME ?? "",
): number => {
  if (home === "") {
    throw new Error("HOME is required for local artifact pruning");
  }

  let removed = 0;

  for (const commandName of manifest.legacyCommands) {
    const commandPath = join(home, ".claude", "commands", commandName);
    if (existsSync(commandPath)) {
      rmSync(commandPath, { recursive: true, force: true });
      removed += 1;
    }
  }

  for (const commandName of manifest.legacyMimocodeCommands) {
    const commandPath = join(home, ".config", "mimocode", "command", commandName);
    if (existsSync(commandPath)) {
      rmSync(commandPath, { recursive: true, force: true });
      removed += 1;
    }
  }

  for (const skillName of manifest.legacySkills) {
    for (const installRoot of skillInstallRoots(home)) {
      const skillPath = join(installRoot, skillName);
      if (existsSync(skillPath)) {
        rmSync(skillPath, { recursive: true, force: true });
        removed += 1;
      }
    }
  }

  return removed;
};

const readOwnedRootSkillState = (home: string): OwnedRootSkillState | null => {
  const statePath = ownedRootSkillsStatePath(home);
  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as Partial<OwnedRootSkillState>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.rootSkills)) {
      return null;
    }

    return {
      schemaVersion: 1,
      rootSkills: parsed.rootSkills.filter((skillName): skillName is string => (
        typeof skillName === "string" && isSafeName(skillName)
      )),
    };
  } catch {
    return null;
  }
};

export const pruneRemovedOwnedRootSkills = (
  manifest: LocalSkillManifest,
  home = process.env.HOME ?? "",
): number => {
  if (home === "") {
    throw new Error("HOME is required for local owned skill pruning");
  }

  const state = readOwnedRootSkillState(home);
  if (!state) {
    return 0;
  }

  const desired = new Set(manifest.rootSkills);
  let removed = 0;

  for (const skillName of state.rootSkills) {
    if (desired.has(skillName)) {
      continue;
    }

    for (const installRoot of skillInstallRoots(home)) {
      const skillPath = join(installRoot, skillName);
      if (existsSync(skillPath)) {
        rmSync(skillPath, { recursive: true, force: true });
        removed += 1;
      }
    }
  }

  return removed;
};

export const recordOwnedRootSkills = (
  manifest: LocalSkillManifest,
  home = process.env.HOME ?? "",
): void => {
  if (home === "") {
    throw new Error("HOME is required for local owned skill state");
  }

  const statePath = ownedRootSkillsStatePath(home);
  mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
  writeFileSync(
    statePath,
    JSON.stringify({ schemaVersion: 1, rootSkills: manifest.rootSkills } satisfies OwnedRootSkillState, null, 2) + "\n",
  );
};

const usage = () => {
  console.error("Usage: local-skill-manifest.ts <root-skills|check-root-skills|prune|prune-owned-root-skills|record-owned-root-skills|self-test> <manifest> [root-skills-dir]");
};

const main = async () => {
  const [command, manifestPath, rootSkillsDir] = process.argv.slice(2);

  try {
    if (command === "self-test") {
      const tempHome = mkdtempSync(join(tmpdir(), "local-skill-manifest-"));
      const manifest = parseManifestText("root-skill alpha\nlegacy-skill old-skill\nlegacy-command old.md\nlegacy-mimocode-command stale.md\n");
      mkdirSync(join(tempHome, ".codex", "skills", "old-skill"), { recursive: true });
      mkdirSync(join(tempHome, ".codex", "skills", "alpha"), { recursive: true });
      mkdirSync(join(tempHome, ".codex", "skills", "removed-alpha"), { recursive: true });
      mkdirSync(join(tempHome, ".claude", "commands"), { recursive: true });
      writeFileSync(join(tempHome, ".claude", "commands", "old.md"), "");
      mkdirSync(join(tempHome, ".config", "mimocode", "command"), { recursive: true });
      writeFileSync(join(tempHome, ".config", "mimocode", "command", "stale.md"), "");
      mkdirSync(join(tempHome, ".intuitive-flow"), { recursive: true });
      writeFileSync(ownedRootSkillsStatePath(tempHome), JSON.stringify({ schemaVersion: 1, rootSkills: ["alpha", "removed-alpha"] }) + "\n");
      const removed = pruneLegacyArtifacts(manifest, tempHome);
      const removedOwned = pruneRemovedOwnedRootSkills(manifest, tempHome);
      recordOwnedRootSkills(manifest, tempHome);
      rmSync(tempHome, { recursive: true, force: true });
      if (removed !== 3) {
        throw new Error(`self-test expected 3 removals, got ${removed}`);
      }
      if (removedOwned !== 1) {
        throw new Error(`self-test expected 1 owned removal, got ${removedOwned}`);
      }
      return;
    }

    if (!command || !manifestPath) {
      usage();
      process.exit(2);
    }

    const manifest = await readManifest(manifestPath);

    if (command === "root-skills") {
      console.log(manifest.rootSkills.join("\n"));
      return;
    }

    if (command === "check-root-skills") {
      if (!rootSkillsDir) {
        usage();
        process.exit(2);
      }
      const errors = checkRootSkills(manifest, rootSkillsDir);
      for (const error of errors) {
        console.error(`  ! ${error}`);
      }
      process.exit(errors.length === 0 ? 0 : 1);
    }

    if (command === "prune") {
      const removed = pruneLegacyArtifacts(manifest);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale local command/skill artifact(s)`);
      }
      return;
    }

    if (command === "prune-owned-root-skills") {
      const removed = pruneRemovedOwnedRootSkills(manifest);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale owned root skill artifact(s)`);
      }
      return;
    }

    if (command === "record-owned-root-skills") {
      recordOwnedRootSkills(manifest);
      return;
    }

    usage();
    process.exit(2);
  } catch (error) {
    console.error(`  ! ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

if (import.meta.main) {
  await main();
}
