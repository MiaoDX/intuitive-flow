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

const usage = () => {
  console.error("Usage: gsd-skill-state.ts sync <allowlist>");
};

const main = () => {
  const [command, allowlistPath] = process.argv.slice(2);

  try {
    if (command !== "sync" || !allowlistPath) {
      usage();
      process.exit(2);
    }

    const removed = syncGsdSkillState(allowlistPath);
    if (removed > 0) {
      console.log(`  ✓ removed ${removed} stale GSD skill artifact(s)`);
    }
  } catch (error) {
    console.error(`  ! ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

if (import.meta.main) {
  main();
}
