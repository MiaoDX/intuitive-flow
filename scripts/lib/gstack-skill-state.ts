#!/usr/bin/env bun

import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  readdirSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { normalizeSource, readDefaultSkillAllowlist } from "./default-skill-allowlist";
import { isSafeName, readState, removeIfExists, stateDir, writeState } from "./managed-skill-state-common";

const gstackCodexStatePath = (home: string) => join(stateDir(home), "gstack-codex-skills.json");
const gstackClaudeStatePath = (home: string) => join(stateDir(home), "gstack-claude-skills.json");

const pathInside = (candidate: string, root: string) => {
  const candidateAbs = resolve(candidate);
  const rootAbs = resolve(root);
  return candidateAbs === rootAbs || candidateAbs.startsWith(rootAbs + sep);
};

const realPathInside = (candidate: string, root: string) => {
  try {
    return pathInside(realpathSync(candidate), realpathSync(root));
  } catch {
    return false;
  }
};

const symlinkTarget = (linkPath: string): string | null => {
  try {
    const target = readlinkSync(linkPath);
    return resolve(dirname(linkPath), target);
  } catch {
    return null;
  }
};

const symlinkPointsInside = (linkPath: string, root: string) => {
  const target = symlinkTarget(linkPath);
  return target !== null && (pathInside(target, root) || realPathInside(target, root));
};

const listGstackCodexSkillNames = (repoDir: string): string[] => {
  const agentsDir = join(repoDir, ".agents", "skills");
  if (!existsSync(agentsDir)) {
    return [];
  }

  return readdirSync(agentsDir)
    .filter((entry) => entry.startsWith("gstack-"))
    .filter((entry) => existsSync(join(agentsDir, entry, "SKILL.md")))
    .sort();
};

const listGstackCodexDesiredSkillNames = (repoDir: string, allowlistPath: string): string[] => {
  const available = listGstackCodexSkillNames(repoDir);
  const desired = readDefaultSkillAllowlist(allowlistPath).gstackSkills;
  const availableSet = new Set(available);
  return desired.filter((skillName) => availableSet.has(skillName));
};

const readSkillName = (skillDir: string): string | null => {
  const skillPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillPath)) {
    return null;
  }

  const content = readFileSync(skillPath, "utf8");
  const match = content.match(/^name:\s*["']?([^"'\r\n]+)["']?\s*$/m);
  if (!match) {
    return null;
  }

  const skillName = match[1].trim();
  return isSafeName(skillName) ? skillName : null;
};

const listGstackClaudeSourceStems = (repoDir: string): string[] => {
  if (!existsSync(repoDir)) {
    return [];
  }

  return readdirSync(repoDir)
    .filter((entry) => isSafeName(entry))
    .filter((entry) => entry !== "node_modules" && existsSync(join(repoDir, entry, "SKILL.md")))
    .sort();
};

const listGstackClaudeDesiredSkillNames = (repoDir: string, allowlistPath: string): string[] => {
  const availableStems = listGstackClaudeSourceStems(repoDir);
  const stems = readDefaultSkillAllowlist(allowlistPath).gstackSkills
    .map((skillName) => skillName.replace(/^gstack-/, ""))
    .filter((stem) => availableStems.includes(stem));
  const desired = new Set<string>(["gstack", "_gstack-command"]);

  for (const stem of stems) {
    const skillName = readSkillName(join(repoDir, stem)) ?? stem;
    if (isSafeName(skillName)) {
      desired.add(skillName);
    }
  }

  return [...desired].sort();
};

const lstatIfExists = (path: string) => {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
};

const claudeSkillPointsInside = (skillPath: string, repoDir: string) => {
  const skillStat = lstatIfExists(skillPath);
  if (!skillStat) {
    return false;
  }

  if (skillStat.isSymbolicLink()) {
    return symlinkPointsInside(skillPath, repoDir);
  }

  const skillMd = join(skillPath, "SKILL.md");
  const skillMdStat = lstatIfExists(skillMd);
  return skillMdStat !== null && skillMdStat.isSymbolicLink() && symlinkPointsInside(skillMd, repoDir);
};

const removeClaudeGstackSkillIfManaged = (home: string, repoDir: string, skillName: string): number => {
  if (!isSafeName(skillName)) {
    return 0;
  }

  const skillPath = join(home, ".claude", "skills", skillName);
  if (!claudeSkillPointsInside(skillPath, repoDir)) {
    return 0;
  }

  return removeIfExists(skillPath);
};

const pruneBrokenClaudeGstackLinks = (home: string, repoDir: string): number => {
  const claudeSkills = join(home, ".claude", "skills");
  if (!existsSync(claudeSkills)) {
    return 0;
  }

  let removed = 0;
  for (const entry of readdirSync(claudeSkills)) {
    if (!isSafeName(entry)) {
      continue;
    }

    const skillDir = join(claudeSkills, entry);
    const skillMd = join(skillDir, "SKILL.md");

    try {
      if (!lstatSync(skillMd).isSymbolicLink()) {
        continue;
      }
    } catch {
      continue;
    }

    const target = symlinkTarget(skillMd);
    if (target !== null && pathInside(target, repoDir) && !existsSync(target)) {
      removed += removeIfExists(skillDir);
    }
  }

  return removed;
};

export const syncGstackSkillState = (
  repoDir: string,
  allowlistPath: string,
  home = process.env.HOME ?? "",
  codexHome = process.env.CODEX_HOME ?? join(home, ".codex"),
): number => {
  if (home === "") {
    throw new Error("HOME is required for gstack skill state");
  }

  const repoAbs = resolve(repoDir);
  const codexSkills = join(codexHome, "skills");
  const desiredCodexSkills = listGstackCodexDesiredSkillNames(repoAbs, allowlistPath);
  const desiredCodex = new Set(desiredCodexSkills);
  const codexStatePath = gstackCodexStatePath(home);
  const previousCodex = readState(codexStatePath);
  let removed = 0;

  if (previousCodex) {
    for (const skillName of previousCodex.skills) {
      if (!desiredCodex.has(skillName)) {
        removed += removeIfExists(join(codexSkills, skillName));
      }
    }
  }

  if (existsSync(codexSkills)) {
    for (const entry of readdirSync(codexSkills)) {
      if (!entry.startsWith("gstack-") || !isSafeName(entry) || desiredCodex.has(entry)) {
        continue;
      }

      const skillPath = join(codexSkills, entry);
      try {
        if (lstatSync(skillPath).isSymbolicLink() && symlinkPointsInside(skillPath, repoAbs)) {
          removed += removeIfExists(skillPath);
        }
      } catch {
        continue;
      }
    }
  }

  const desiredClaudeSkills = listGstackClaudeDesiredSkillNames(repoAbs, allowlistPath);
  const desiredClaude = new Set(desiredClaudeSkills);
  const claudeStatePath = gstackClaudeStatePath(home);
  const previousClaude = readState(claudeStatePath);

  if (previousClaude) {
    for (const skillName of previousClaude.skills) {
      if (!desiredClaude.has(skillName)) {
        removed += removeClaudeGstackSkillIfManaged(home, repoAbs, skillName);
      }
    }
  }

  const claudeSkills = join(home, ".claude", "skills");
  if (existsSync(claudeSkills)) {
    for (const entry of readdirSync(claudeSkills)) {
      if (!isSafeName(entry) || desiredClaude.has(entry)) {
        continue;
      }

      removed += removeClaudeGstackSkillIfManaged(home, repoAbs, entry);
    }
  }

  removed += pruneBrokenClaudeGstackLinks(home, repoAbs);

  writeState(codexStatePath, {
    schemaVersion: 1,
    source: normalizeSource("garrytan/gstack"),
    skills: desiredCodexSkills,
  });
  writeState(claudeStatePath, {
    schemaVersion: 1,
    source: normalizeSource("garrytan/gstack"),
    skills: desiredClaudeSkills,
  });

  return removed;
};

const usage = () => {
  console.error("Usage: gstack-skill-state.ts sync <repo-dir> <allowlist>");
};

const main = () => {
  const [command, repoDir, allowlistPath] = process.argv.slice(2);

  try {
    if (command !== "sync" || !repoDir || !allowlistPath) {
      usage();
      process.exit(2);
    }

    const removed = syncGstackSkillState(repoDir, allowlistPath);
    if (removed > 0) {
      console.log(`  ✓ removed ${removed} stale gstack skill artifact(s)`);
    }
  } catch (error) {
    console.error(`  ! ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

if (import.meta.main) {
  main();
}
