#!/usr/bin/env bun

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { findExternalSkillSource, readExternalSkillSources } from "./external-skill-sources";

type SkillState = {
  schemaVersion: 1;
  source: string;
  skills: string[];
};

type SkillLock = {
  skills?: Record<string, { source?: string }>;
};

const stateDir = (home: string) => join(home, ".intuitive-flow");
const gstackCodexStatePath = (home: string) => join(stateDir(home), "gstack-codex-skills.json");
const gstackClaudeStatePath = (home: string) => join(stateDir(home), "gstack-claude-skills.json");
const externalStatePath = (home: string, label: string) => join(stateDir(home), `external-skills-${label}.json`);

type GstackSurface = "standard" | "full";

const standardGstackCodexSkills = Object.freeze([
  "gstack-browse",
  "gstack-guard",
  "gstack-health",
  "gstack-investigate",
  "gstack-open-gstack-browser",
  "gstack-plan-eng-review",
  "gstack-qa",
  "gstack-review",
  "gstack-scrape",
  "gstack-ship",
  "gstack-spec",
]);

const standardGstackClaudeSkillStems = Object.freeze([
  "browse",
  "guard",
  "health",
  "investigate",
  "open-gstack-browser",
  "plan-eng-review",
  "qa",
  "review",
  "scrape",
  "ship",
  "spec",
]);

const isSafeName = (value: string) => /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(value) && !value.includes("..");

const resolveGstackSurface = (): GstackSurface => {
  const raw = process.env.GSTACK_SKILL_SURFACE ?? "standard";
  if (raw === "standard" || raw === "") {
    return "standard";
  }
  if (raw === "full" || raw === "all") {
    return "full";
  }

  throw new Error(`unsupported GSTACK_SKILL_SURFACE=${raw}; expected standard or full`);
};

const readState = (path: string): SkillState | null => {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<SkillState>;
    if (parsed.schemaVersion !== 1 || typeof parsed.source !== "string" || !Array.isArray(parsed.skills)) {
      return null;
    }

    return {
      schemaVersion: 1,
      source: parsed.source,
      skills: parsed.skills.filter((skillName): skillName is string => (
        typeof skillName === "string" && isSafeName(skillName)
      )),
    };
  } catch {
    return null;
  }
};

const writeState = (path: string, state: SkillState) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
};

const normalizeSource = (source: string) => source
  .replace(/^https:\/\/github\.com\//, "")
  .replace(/\.git$/, "");

const removeIfExists = (path: string): number => {
  try {
    lstatSync(path);
  } catch {
    return 0;
  }

  rmSync(path, { recursive: true, force: true });
  return 1;
};

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

const listGstackCodexDesiredSkillNames = (repoDir: string, surface: GstackSurface): string[] => {
  const available = listGstackCodexSkillNames(repoDir);
  if (surface === "full") {
    return available;
  }

  const availableSet = new Set(available);
  return standardGstackCodexSkills.filter((skillName) => availableSet.has(skillName));
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

const listGstackClaudeDesiredSkillNames = (repoDir: string, surface: GstackSurface): string[] => {
  const availableStems = listGstackClaudeSourceStems(repoDir);
  const stems = surface === "full"
    ? availableStems
    : standardGstackClaudeSkillStems.filter((stem) => availableStems.includes(stem));
  const desired = new Set<string>(["gstack", "_gstack-command"]);

  for (const stem of stems) {
    const skillName = readSkillName(join(repoDir, stem)) ?? stem;
    if (isSafeName(skillName)) {
      desired.add(skillName);
    }
  }

  if (surface === "full") {
    const browserSkillName = readSkillName(join(repoDir, "open-gstack-browser")) ?? "open-gstack-browser";
    desired.add(browserSkillName.startsWith("gstack-") ? "gstack-connect-chrome" : "connect-chrome");
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
  home = process.env.HOME ?? "",
  codexHome = process.env.CODEX_HOME ?? join(home, ".codex"),
  surface = resolveGstackSurface(),
): number => {
  if (home === "") {
    throw new Error("HOME is required for gstack skill state");
  }

  const repoAbs = resolve(repoDir);
  const codexSkills = join(codexHome, "skills");
  const desiredCodexSkills = listGstackCodexDesiredSkillNames(repoAbs, surface);
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

  const desiredClaudeSkills = listGstackClaudeDesiredSkillNames(repoAbs, surface);
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

const lockedSkillsForSource = (home: string, source: string): string[] => {
  const normalizedSource = normalizeSource(source);
  const skills = readSkillLock(home).skills ?? {};

  return Object.entries(skills)
    .filter(([, metadata]) => normalizeSource(metadata.source ?? "") === normalizedSource)
    .map(([skillName]) => skillName)
    .filter(isSafeName)
    .sort();
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
  manifestPath: string,
  label: string,
  home = process.env.HOME ?? "",
): number => {
  if (home === "") {
    throw new Error("HOME is required for external skill state");
  }

  const manifest = readExternalSkillSources(manifestPath);
  const source = findExternalSkillSource(manifest, label);
  const normalizedSource = normalizeSource(source.repo);
  const desiredSkills = source.mode === "allowlist"
    ? source.skills.filter(isSafeName).sort()
    : lockedSkillsForSource(home, normalizedSource);
  if (source.mode === "all" && desiredSkills.length === 0) {
    return 0;
  }
  const desired = new Set(desiredSkills);
  const statePath = externalStatePath(home, label);
  const previous = readState(statePath);
  let removed = 0;

  if (previous) {
    for (const skillName of previous.skills) {
      if (desired.has(skillName)) {
        continue;
      }

      removed += removeExternalSkillIfPresent(join(home, ".agents", "skills", skillName));
      removed += removeExternalSkillIfPresent(join(home, ".claude", "skills", skillName));
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

const usage = () => {
  console.error("Usage: managed-skill-state.ts <gstack-sync|external-sync> <args...>");
};

const main = () => {
  const [command, ...args] = process.argv.slice(2);

  try {
    if (command === "gstack-sync") {
      const [repoDir] = args;
      if (!repoDir) {
        usage();
        process.exit(2);
      }

      const removed = syncGstackSkillState(repoDir);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale gstack skill artifact(s)`);
      }
      return;
    }

    if (command === "external-sync") {
      const [manifestPath, label] = args;
      if (!manifestPath || !label) {
        usage();
        process.exit(2);
      }

      const removed = syncExternalSkillState(manifestPath, label);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale external skill artifact(s) for ${label}`);
      }
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
  main();
}
