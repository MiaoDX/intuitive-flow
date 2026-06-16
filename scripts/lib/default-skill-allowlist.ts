#!/usr/bin/env bun

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type RepoSkillAllowlist = {
  rootSkills: string[];
  legacySkills: string[];
  legacyCommands: string[];
  legacyMimocodeCommands: string[];
};

export type ExternalSkillSource = {
  label: string;
  repo: string;
  skills: string[];
};

export type DefaultSkillAllowlist = RepoSkillAllowlist & {
  externalSources: ExternalSkillSource[];
  gstackSkills: string[];
  gsdSkills: string[];
};

type AllowlistKind =
  | "root-skill"
  | "external-skill"
  | "gstack-skill"
  | "gsd-skill"
  | "legacy-skill"
  | "legacy-command"
  | "legacy-mimocode-command";

const skillNamePattern = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
const labelPattern = /^[a-z][a-z0-9-]*$/;
const repoSlugPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const githubUrlPattern = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/;
const commandNamePattern = /^[A-Za-z0-9_.-]+\.md$/;
const ownedRootSkillsStatePath = (home: string) => join(home, ".intuitive-flow", "owned-root-skills.json");
const skillInstallRoots = (home: string) => [
  join(home, ".codex", "skills"),
  join(home, ".agents", "skills"),
  join(home, ".claude", "skills"),
];

type OwnedRootSkillState = {
  schemaVersion: 1;
  rootSkills: string[];
};

export const defaultSkillAllowlistPath = (cwd = process.cwd()) => join(cwd, "scripts", "default-skill-allowlist.txt");

const emptyAllowlist = (): DefaultSkillAllowlist => ({
  rootSkills: [],
  legacySkills: [],
  legacyCommands: [],
  legacyMimocodeCommands: [],
  externalSources: [],
  gstackSkills: [],
  gsdSkills: [],
});

const assertSafeSkillName = (value: string, lineNumber: number) => {
  if (!skillNamePattern.test(value) || value.includes("..")) {
    throw new Error(`unsafe skill name on line ${lineNumber}: ${value}`);
  }
};

const assertSafeCommandName = (value: string, lineNumber: number) => {
  if (!commandNamePattern.test(value) || value.includes("..")) {
    throw new Error(`unsafe command name on line ${lineNumber}: ${value}`);
  }
};

const assertSafeLabel = (value: string, lineNumber: number) => {
  if (!labelPattern.test(value)) {
    throw new Error(`unsafe external skill source label on line ${lineNumber}: ${value}`);
  }
};

const assertSafeRepo = (value: string, lineNumber: number) => {
  if (!repoSlugPattern.test(value) && !githubUrlPattern.test(value)) {
    throw new Error(`unsupported external skill repo on line ${lineNumber}: ${value}`);
  }
};

const pushUnique = (values: string[], value: string) => {
  if (!values.includes(value)) {
    values.push(value);
  }
};

const intersection = (left: string[], right: string[]): string[] => {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).sort();
};

const sourceKey = (label: string, repo: string) => `${label}\0${repo}`;

export const normalizeSource = (source: string) => source
  .replace(/^https:\/\/github\.com\//, "")
  .replace(/\.git$/, "");

export const parseDefaultSkillAllowlistText = (text: string): DefaultSkillAllowlist => {
  const allowlist = emptyAllowlist();
  const externalSourcesByKey = new Map<string, ExternalSkillSource>();
  const labelToRepo = new Map<string, string>();
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      return;
    }

    const parts = line.split(/\s+/);
    const [kind] = parts as [AllowlistKind | string, ...string[]];
    if (![
      "root-skill",
      "external-skill",
      "gstack-skill",
      "gsd-skill",
      "legacy-skill",
      "legacy-command",
      "legacy-mimocode-command",
    ].includes(kind)) {
      throw new Error(`unknown default skill allowlist kind on line ${lineNumber}: ${kind}`);
    }

    const dedupeKey = parts.join("\0");
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);

    if (kind === "root-skill") {
      if (parts.length !== 2) {
        throw new Error(`invalid root-skill line ${lineNumber}: ${rawLine}`);
      }
      const [, skillName] = parts;
      assertSafeSkillName(skillName, lineNumber);
      pushUnique(allowlist.rootSkills, skillName);
      return;
    }

    if (kind === "external-skill") {
      if (parts.length !== 4) {
        throw new Error(`invalid external-skill line ${lineNumber}: ${rawLine}`);
      }
      const [, label, repo, skillName] = parts;
      assertSafeLabel(label, lineNumber);
      assertSafeRepo(repo, lineNumber);
      assertSafeSkillName(skillName, lineNumber);

      const previousRepo = labelToRepo.get(label);
      if (previousRepo && normalizeSource(previousRepo) !== normalizeSource(repo)) {
        throw new Error(`external skill source label maps to multiple repos on line ${lineNumber}: ${label}`);
      }
      labelToRepo.set(label, repo);

      const key = sourceKey(label, repo);
      const source = externalSourcesByKey.get(key) ?? { label, repo, skills: [] };
      pushUnique(source.skills, skillName);
      externalSourcesByKey.set(key, source);
      return;
    }

    if (kind === "gstack-skill") {
      if (parts.length !== 2) {
        throw new Error(`invalid gstack-skill line ${lineNumber}: ${rawLine}`);
      }
      const [, skillName] = parts;
      assertSafeSkillName(skillName, lineNumber);
      pushUnique(allowlist.gstackSkills, skillName);
      return;
    }

    if (kind === "gsd-skill") {
      if (parts.length !== 2) {
        throw new Error(`invalid gsd-skill line ${lineNumber}: ${rawLine}`);
      }
      const [, skillName] = parts;
      assertSafeSkillName(skillName, lineNumber);
      pushUnique(allowlist.gsdSkills, skillName);
      return;
    }

    if (kind === "legacy-skill") {
      if (parts.length !== 2) {
        throw new Error(`invalid legacy-skill line ${lineNumber}: ${rawLine}`);
      }
      const [, skillName] = parts;
      assertSafeSkillName(skillName, lineNumber);
      pushUnique(allowlist.legacySkills, skillName);
      return;
    }

    if (kind === "legacy-command" || kind === "legacy-mimocode-command") {
      if (parts.length !== 2) {
        throw new Error(`invalid ${kind} line ${lineNumber}: ${rawLine}`);
      }
      const [, commandName] = parts;
      assertSafeCommandName(commandName, lineNumber);
      pushUnique(kind === "legacy-command" ? allowlist.legacyCommands : allowlist.legacyMimocodeCommands, commandName);
    }
  });

  allowlist.externalSources = [...externalSourcesByKey.values()].map((source) => ({
    ...source,
    skills: source.skills.sort(),
  })).sort((left, right) => left.label.localeCompare(right.label));
  allowlist.rootSkills.sort();
  allowlist.legacySkills.sort();
  allowlist.legacyCommands.sort();
  allowlist.legacyMimocodeCommands.sort();
  allowlist.gstackSkills.sort();
  allowlist.gsdSkills.sort();

  const liveSkillNames = [
    ...allowlist.rootSkills,
    ...allowlist.externalSources.flatMap((source) => source.skills),
    ...allowlist.gstackSkills,
    ...allowlist.gsdSkills,
  ];
  const conflictingLegacySkills = intersection(allowlist.legacySkills, liveSkillNames);
  if (conflictingLegacySkills.length > 0) {
    throw new Error(`skill listed as both current and legacy: ${conflictingLegacySkills.join(", ")}`);
  }

  const liveCommandNames = [
    ...allowlist.rootSkills.map((skillName) => `${skillName}.md`),
    ...allowlist.gstackSkills.map((skillName) => `${skillName}.md`),
    ...allowlist.gsdSkills.map((skillName) => `${skillName}.md`),
  ];
  const conflictingLegacyCommands = intersection(
    [...allowlist.legacyCommands, ...allowlist.legacyMimocodeCommands],
    liveCommandNames,
  );
  if (conflictingLegacyCommands.length > 0) {
    throw new Error(`command listed as both current and legacy: ${conflictingLegacyCommands.join(", ")}`);
  }

  return allowlist;
};

export const readDefaultSkillAllowlist = (path = defaultSkillAllowlistPath()): DefaultSkillAllowlist => {
  if (!existsSync(path)) {
    throw new Error(`missing default skill allowlist: ${path}`);
  }
  return parseDefaultSkillAllowlistText(readFileSync(path, "utf8"));
};

export const externalSkillSourceByLabel = (allowlist: DefaultSkillAllowlist, label: string): ExternalSkillSource => {
  const source = allowlist.externalSources.find((candidate) => candidate.label === label);
  if (!source) {
    throw new Error(`unknown external skill source: ${label}`);
  }
  return source;
};

export const checkRootSkills = (allowlist: DefaultSkillAllowlist, rootSkillsDir: string): string[] => {
  const errors: string[] = [];
  const listed = new Set(allowlist.rootSkills);

  for (const skillName of allowlist.rootSkills) {
    if (!existsSync(join(rootSkillsDir, skillName, "SKILL.md"))) {
      errors.push(`default allowlist lists missing root skill: ${skillName}`);
    }
  }

  if (existsSync(rootSkillsDir)) {
    for (const entry of readdirSync(rootSkillsDir)) {
      const skillDir = join(rootSkillsDir, entry);
      if (statSync(skillDir).isDirectory() && existsSync(join(skillDir, "SKILL.md")) && !listed.has(entry)) {
        errors.push(`root skill missing from default allowlist: ${entry}`);
      }
    }
  }

  return errors;
};

export const pruneLegacyArtifacts = (
  allowlist: DefaultSkillAllowlist,
  home = process.env.HOME ?? "",
): number => {
  if (home === "") {
    throw new Error("HOME is required for local artifact pruning");
  }

  let removed = 0;

  for (const commandName of allowlist.legacyCommands) {
    const commandPath = join(home, ".claude", "commands", commandName);
    if (existsSync(commandPath)) {
      rmSync(commandPath, { recursive: true, force: true });
      removed += 1;
    }
  }

  for (const commandName of allowlist.legacyMimocodeCommands) {
    const commandPath = join(home, ".config", "mimocode", "command", commandName);
    if (existsSync(commandPath)) {
      rmSync(commandPath, { recursive: true, force: true });
      removed += 1;
    }
  }

  for (const skillName of allowlist.legacySkills) {
    for (const installRoot of skillInstallRoots(home)) {
      const skillPath = join(installRoot, skillName);
      if (existsSync(skillPath)) {
        rmSync(skillPath, { recursive: true, force: true });
        removed += 1;
      }
    }

    const mimocodeCommandPath = join(home, ".config", "mimocode", "command", `${skillName}.md`);
    if (existsSync(mimocodeCommandPath)) {
      rmSync(mimocodeCommandPath, { recursive: true, force: true });
      removed += 1;
    }
  }

  return removed;
};

const isSafeName = (value: string) => skillNamePattern.test(value) && !value.includes("..");

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
  allowlist: DefaultSkillAllowlist,
  home = process.env.HOME ?? "",
): number => {
  if (home === "") {
    throw new Error("HOME is required for local owned skill pruning");
  }

  const state = readOwnedRootSkillState(home);
  if (!state) {
    return 0;
  }

  const desired = new Set(allowlist.rootSkills);
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
  allowlist: DefaultSkillAllowlist,
  home = process.env.HOME ?? "",
): void => {
  if (home === "") {
    throw new Error("HOME is required for local owned skill state");
  }

  const statePath = ownedRootSkillsStatePath(home);
  mkdirSync(join(home, ".intuitive-flow"), { recursive: true });
  writeFileSync(
    statePath,
    JSON.stringify({ schemaVersion: 1, rootSkills: allowlist.rootSkills } satisfies OwnedRootSkillState, null, 2) + "\n",
  );
};

const usage = () => {
  console.error("Usage: default-skill-allowlist.ts <validate|root-skills|check-root-skills|prune|prune-owned-root-skills|record-owned-root-skills|external-labels|external-repo|external-skill-args|gstack-skills|gsd-skills|self-test> <allowlist> [arg]");
};

const main = () => {
  const [command, allowlistPath, label] = process.argv.slice(2);
  if (!command || !allowlistPath) {
    usage();
    process.exit(2);
  }

  try {
    const allowlist = readDefaultSkillAllowlist(allowlistPath);

    if (command === "self-test") {
      const tempHome = mkdtempSync(join(tmpdir(), "default-skill-allowlist-"));
      const fixture = parseDefaultSkillAllowlistText("root-skill alpha\nlegacy-skill old-skill\nlegacy-command old.md\nlegacy-mimocode-command stale.md\n");
      mkdirSync(join(tempHome, ".codex", "skills", "old-skill"), { recursive: true });
      mkdirSync(join(tempHome, ".codex", "skills", "alpha"), { recursive: true });
      mkdirSync(join(tempHome, ".codex", "skills", "removed-alpha"), { recursive: true });
      mkdirSync(join(tempHome, ".claude", "commands"), { recursive: true });
      writeFileSync(join(tempHome, ".claude", "commands", "old.md"), "");
      mkdirSync(join(tempHome, ".config", "mimocode", "command"), { recursive: true });
      writeFileSync(join(tempHome, ".config", "mimocode", "command", "stale.md"), "");
      writeFileSync(join(tempHome, ".config", "mimocode", "command", "old-skill.md"), "");
      mkdirSync(join(tempHome, ".intuitive-flow"), { recursive: true });
      writeFileSync(ownedRootSkillsStatePath(tempHome), JSON.stringify({ schemaVersion: 1, rootSkills: ["alpha", "removed-alpha"] }) + "\n");
      const removed = pruneLegacyArtifacts(fixture, tempHome);
      const removedOwned = pruneRemovedOwnedRootSkills(fixture, tempHome);
      recordOwnedRootSkills(fixture, tempHome);
      rmSync(tempHome, { recursive: true, force: true });
      if (removed !== 4) {
        throw new Error(`self-test expected 4 removals, got ${removed}`);
      }
      if (removedOwned !== 1) {
        throw new Error(`self-test expected 1 owned removal, got ${removedOwned}`);
      }
      return;
    }

    if (command === "validate") {
      console.log("  ✓ default skill allowlist is valid");
      return;
    }

    if (command === "root-skills") {
      console.log(allowlist.rootSkills.join("\n"));
      return;
    }

    if (command === "check-root-skills") {
      if (!label) {
        usage();
        process.exit(2);
      }
      const errors = checkRootSkills(allowlist, label);
      for (const error of errors) {
        console.error(`  ! ${error}`);
      }
      process.exit(errors.length === 0 ? 0 : 1);
    }

    if (command === "prune") {
      const removed = pruneLegacyArtifacts(allowlist);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale local command/skill artifact(s)`);
      }
      return;
    }

    if (command === "prune-owned-root-skills") {
      const removed = pruneRemovedOwnedRootSkills(allowlist);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale owned root skill artifact(s)`);
      }
      return;
    }

    if (command === "record-owned-root-skills") {
      recordOwnedRootSkills(allowlist);
      return;
    }

    if (command === "external-labels") {
      console.log(allowlist.externalSources.map((source) => source.label).join("\n"));
      return;
    }

    if (command === "gstack-skills") {
      console.log(allowlist.gstackSkills.join("\n"));
      return;
    }

    if (command === "gsd-skills") {
      console.log(allowlist.gsdSkills.join("\n"));
      return;
    }

    if (!label) {
      usage();
      process.exit(2);
    }

    const source = externalSkillSourceByLabel(allowlist, label);

    if (command === "external-repo") {
      console.log(source.repo);
      return;
    }

    if (command === "external-skill-args") {
      console.log(source.skills.flatMap((skill) => ["--skill", skill]).join("\n"));
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
