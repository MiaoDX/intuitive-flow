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
import { externalSkillSourceByLabel, normalizeSource, readDefaultSkillAllowlist, readPruneLedger } from "./default-skill-allowlist";

type SkillState = {
  schemaVersion: 1;
  source: string;
  skills: string[];
};

type SkillLock = {
  skills?: Record<string, { source?: string }>;
};

type OwnedRootSkillState = {
  schemaVersion: 1;
  rootSkills: string[];
};

const stateDir = (home: string) => join(home, ".intuitive-flow");
const ownedRootSkillsStatePath = (home: string) => join(stateDir(home), "owned-root-skills.json");
const gstackCodexStatePath = (home: string) => join(stateDir(home), "gstack-codex-skills.json");
const gstackClaudeStatePath = (home: string) => join(stateDir(home), "gstack-claude-skills.json");
const gsdStatePath = (home: string) => join(stateDir(home), "gsd-skills.json");
const externalStatePath = (home: string, label: string) => join(stateDir(home), `external-skills-${label}.json`);
const externalStateFilePattern = /^external-skills-([A-Za-z0-9-]+)\.json$/;
const skillInstallRoots = (home: string) => [
  join(home, ".codex", "skills"),
  join(home, ".agents", "skills"),
  join(home, ".claude", "skills"),
];

const isSafeName = (value: string) => /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(value) && !value.includes("..");

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

const removeExternalSkillInstalls = (home: string, skillName: string): number => (
  skillInstallRoots(home).reduce((removed, root) => removed + removeExternalSkillIfPresent(join(root, skillName)), 0)
);

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
    removed += removeIfExists(join(home, ".config", "mimocode", "command", `${skillName}.md`));
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

  for (const commandName of ledger.legacyMimocodeCommands) {
    removed += removeIfExists(join(home, ".config", "mimocode", "command", commandName));
  }

  for (const skillName of ledger.legacySkills) {
    for (const installRoot of skillInstallRoots(home)) {
      removed += removeIfExists(join(installRoot, skillName));
    }

    removed += removeIfExists(join(home, ".config", "mimocode", "command", `${skillName}.md`));
  }

  return removed;
};

const usage = () => {
  console.error("Usage: managed-skill-state.ts <gstack-sync|external-sync|external-prune-removed|gsd-sync|prune-legacy-artifacts|prune-owned-root-skills|record-owned-root-skills> <args...>");
};

const main = () => {
  const [command, ...args] = process.argv.slice(2);

  try {
    if (command === "gstack-sync") {
      const [repoDir, allowlistPath] = args;
      if (!repoDir || !allowlistPath) {
        usage();
        process.exit(2);
      }

      const removed = syncGstackSkillState(repoDir, allowlistPath);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale gstack skill artifact(s)`);
      }
      return;
    }

    if (command === "gsd-sync") {
      const [allowlistPath] = args;
      if (!allowlistPath) {
        usage();
        process.exit(2);
      }

      const removed = syncGsdSkillState(allowlistPath);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale GSD skill artifact(s)`);
      }
      return;
    }

    if (command === "external-sync") {
      const [allowlistPath, label] = args;
      if (!allowlistPath || !label) {
        usage();
        process.exit(2);
      }

      const removed = syncExternalSkillState(allowlistPath, label);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale external skill artifact(s) for ${label}`);
      }
      return;
    }

    if (command === "external-prune-removed") {
      const [allowlistPath] = args;
      if (!allowlistPath) {
        usage();
        process.exit(2);
      }

      const removed = pruneRemovedExternalSkillStates(allowlistPath);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale external skill artifact(s) for removed source label(s)`);
      }
      return;
    }

    if (command === "prune-owned-root-skills") {
      const [allowlistPath] = args;
      if (!allowlistPath) {
        usage();
        process.exit(2);
      }

      const removed = pruneRemovedOwnedRootSkills(allowlistPath);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale owned root skill artifact(s)`);
      }
      return;
    }

    if (command === "prune-legacy-artifacts") {
      const [pruneLedgerPath] = args;
      if (!pruneLedgerPath) {
        usage();
        process.exit(2);
      }

      const removed = pruneLegacyArtifacts(pruneLedgerPath);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale local command/skill artifact(s)`);
      }
      return;
    }

    if (command === "record-owned-root-skills") {
      const [allowlistPath] = args;
      if (!allowlistPath) {
        usage();
        process.exit(2);
      }

      recordOwnedRootSkills(allowlistPath);
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
