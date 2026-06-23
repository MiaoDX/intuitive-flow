import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readDefaultSkillAllowlist, readPruneLedger } from "./default-skill-allowlist";
import { isSafeName, removeIfExists, skillInstallRoots, stateDir } from "./managed-skill-state-common";

type OwnedRootSkillState = {
  schemaVersion: 1;
  rootSkills: string[];
};

const ownedRootSkillsStatePath = (home: string) => join(stateDir(home), "owned-root-skills.json");

const readOwnedRootSkillState = (home: string): OwnedRootSkillState | null => {
  const path = ownedRootSkillsStatePath(home);
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<OwnedRootSkillState>;
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

const writeOwnedRootSkillState = (home: string, rootSkills: string[]) => {
  const path = ownedRootSkillsStatePath(home);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ schemaVersion: 1, rootSkills } satisfies OwnedRootSkillState, null, 2) + "\n");
};

export const pruneRemovedOwnedRootSkills = (
  allowlistPath: string,
  home = process.env.HOME ?? "",
): number => {
  if (home === "") {
    throw new Error("HOME is required for local owned skill pruning");
  }

  const previous = readOwnedRootSkillState(home);
  if (!previous) {
    return 0;
  }

  const desired = new Set(readDefaultSkillAllowlist(allowlistPath).rootSkills);
  let removed = 0;

  for (const skillName of previous.rootSkills) {
    if (desired.has(skillName)) {
      continue;
    }

    for (const installRoot of skillInstallRoots(home)) {
      removed += removeIfExists(join(installRoot, skillName));
    }
  }

  return removed;
};

export const recordOwnedRootSkills = (
  allowlistPath: string,
  home = process.env.HOME ?? "",
): void => {
  if (home === "") {
    throw new Error("HOME is required for local owned skill state");
  }

  writeOwnedRootSkillState(home, readDefaultSkillAllowlist(allowlistPath).rootSkills);
};

export const pruneLegacyArtifacts = (
  pruneLedgerPath: string,
  home = process.env.HOME ?? "",
): number => {
  if (home === "") {
    throw new Error("HOME is required for local artifact pruning");
  }

  const ledger = readPruneLedger(pruneLedgerPath);
  let removed = 0;

  for (const commandName of ledger.legacyCommands) {
    removed += removeIfExists(join(home, ".claude", "commands", commandName));
  }

  for (const skillName of ledger.legacySkills) {
    for (const installRoot of skillInstallRoots(home)) {
      removed += removeIfExists(join(installRoot, skillName));
    }
  }

  return removed;
};
