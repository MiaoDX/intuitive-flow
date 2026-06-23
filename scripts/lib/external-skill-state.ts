#!/usr/bin/env bun

import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { externalSkillSourceByLabel, normalizeSource, readDefaultSkillAllowlist } from "./default-skill-allowlist";
import { isSafeName, readState, removeIfExists, skillInstallRoots, stateDir, writeState } from "./managed-skill-state-common";

type SkillLock = {
  skills?: Record<string, { source?: string }>;
};

const externalStatePath = (home: string, label: string) => join(stateDir(home), `external-skills-${label}.json`);
const externalStateFilePattern = /^external-skills-([A-Za-z0-9-]+)\.json$/;

const removeExternalSkillIfPresent = (path: string): number => {
  try {
    if (lstatSync(path).isSymbolicLink()) {
      return 0;
    }
  } catch {
    return 0;
  }

  try {
    if (lstatSync(join(path, "SKILL.md")).isSymbolicLink()) {
      return 0;
    }
  } catch {
    // No linked SKILL.md, so a previously recorded external real directory can be removed.
  }

  return removeIfExists(path);
};

const removeExternalSkillInstalls = (home: string, skillName: string): number => (
  skillInstallRoots(home).reduce((removed, root) => removed + removeExternalSkillIfPresent(join(root, skillName)), 0)
);

const readSkillLock = (home: string): SkillLock => {
  const lockPath = join(home, ".agents", ".skill-lock.json");
  if (!existsSync(lockPath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(lockPath, "utf8")) as SkillLock;
  } catch {
    return {};
  }
};

const writeSkillLock = (home: string, lock: SkillLock) => {
  const lockPath = join(home, ".agents", ".skill-lock.json");
  if (!existsSync(lockPath)) {
    return;
  }

  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
};

const removeSkillLockEntry = (home: string, skillName: string, source: string) => {
  const lock = readSkillLock(home);
  const skills = lock.skills ?? {};
  const entry = skills[skillName];
  if (entry && normalizeSource(entry.source ?? "") === normalizeSource(source)) {
    delete skills[skillName];
    lock.skills = skills;
    writeSkillLock(home, lock);
  }
};

export const syncExternalSkillState = (
  allowlistPath: string,
  label: string,
  home = process.env.HOME ?? "",
): number => {
  if (home === "") {
    throw new Error("HOME is required for external skill state");
  }

  const allowlist = readDefaultSkillAllowlist(allowlistPath);
  const source = externalSkillSourceByLabel(allowlist, label);
  const normalizedSource = normalizeSource(source.repo);
  const desiredSkills = source.skills.filter(isSafeName).sort();
  const desired = new Set(desiredSkills);
  const statePath = externalStatePath(home, label);
  const previous = readState(statePath);
  let removed = 0;

  if (previous) {
    for (const skillName of previous.skills) {
      if (desired.has(skillName)) {
        continue;
      }

      removed += removeExternalSkillInstalls(home, skillName);
      removeSkillLockEntry(home, skillName, previous.source);
    }
  }

  writeState(statePath, {
    schemaVersion: 1,
    source: normalizedSource,
    skills: desiredSkills,
  });

  return removed;
};

export const pruneRemovedExternalSkillStates = (
  allowlistPath: string,
  home = process.env.HOME ?? "",
): number => {
  if (home === "") {
    throw new Error("HOME is required for external skill state pruning");
  }

  const allowlist = readDefaultSkillAllowlist(allowlistPath);
  const desiredLabels = new Set(allowlist.externalSources.map((source) => source.label));
  const dir = stateDir(home);
  if (!existsSync(dir)) {
    return 0;
  }

  let removed = 0;
  for (const entry of readdirSync(dir)) {
    const match = externalStateFilePattern.exec(entry);
    if (!match) {
      continue;
    }

    const label = match[1];
    if (desiredLabels.has(label)) {
      continue;
    }

    const statePath = join(dir, entry);
    const previous = readState(statePath);
    if (!previous) {
      continue;
    }

    for (const skillName of previous.skills) {
      removed += removeExternalSkillInstalls(home, skillName);
      removeSkillLockEntry(home, skillName, previous.source);
    }

    removed += removeIfExists(statePath);
  }

  return removed;
};
