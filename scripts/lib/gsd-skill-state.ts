#!/usr/bin/env bun

import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { readDefaultSkillAllowlist } from "./default-skill-allowlist";
import { isSafeName, readState, removeIfExists, stateDir, writeState } from "./managed-skill-state-common";

const gsdStatePath = (home: string) => join(stateDir(home), "gsd-skills.json");

const removeGsdSkillIfManaged = (path: string): number => {
  const skillPath = join(path, "SKILL.md");
  if (!existsSync(skillPath)) {
    return 0;
  }

  try {
    const text = readFileSync(skillPath, "utf8");
    if (!text.includes("get-shit-done")) {
      return 0;
    }
  } catch {
    return 0;
  }

  return removeIfExists(path);
};

export const syncGsdSkillState = (
  allowlistPath: string,
  home = process.env.HOME ?? "",
  codexHome = process.env.CODEX_HOME ?? join(home, ".codex"),
): number => {
  if (home === "") {
    throw new Error("HOME is required for GSD skill state");
  }

  const desiredSkills = readDefaultSkillAllowlist(allowlistPath).gsdSkills.filter(isSafeName).sort();
  const desired = new Set(desiredSkills);
  const statePath = gsdStatePath(home);
  const previous = readState(statePath);
  let removed = 0;

  if (previous) {
    for (const skillName of previous.skills) {
      if (desired.has(skillName)) {
        continue;
      }

      removed += removeGsdSkillIfManaged(join(codexHome, "skills", skillName));
      removed += removeGsdSkillIfManaged(join(home, ".claude", "skills", skillName));
    }
  }

  for (const root of [join(codexHome, "skills"), join(home, ".claude", "skills")]) {
    if (!existsSync(root)) {
      continue;
    }
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith("gsd-") || !isSafeName(entry) || desired.has(entry)) {
        continue;
      }
      removed += removeGsdSkillIfManaged(join(root, entry));
    }
  }

  writeState(statePath, {
    schemaVersion: 1,
    source: "opengsd/get-shit-done-redux",
    skills: desiredSkills,
  });

  return removed;
};
