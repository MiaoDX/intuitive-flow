#!/usr/bin/env bun

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

export type PruneLedger = {
  legacySkills: string[];
  legacyCommands: string[];
  legacyMimocodeCommands: string[];
};

export type ExternalSkillSource = {
  label: string;
  repo: string;
  skills: string[];
};

export type DefaultSkillAllowlist = {
  rootSkills: string[];
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

export const defaultSkillAllowlistPath = (cwd = process.cwd()) => join(cwd, "scripts", "default-skill-allowlist.txt");

const emptyAllowlist = (): DefaultSkillAllowlist => ({
  rootSkills: [],
  externalSources: [],
  gstackSkills: [],
  gsdSkills: [],
});

const emptyPruneLedger = (): PruneLedger => ({
  legacySkills: [],
  legacyCommands: [],
  legacyMimocodeCommands: [],
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
      throw new Error(`default skill allowlist must not contain prune-only legacy entries on line ${lineNumber}: ${rawLine}`);
    }

    if (kind === "legacy-command" || kind === "legacy-mimocode-command") {
      throw new Error(`default skill allowlist must not contain prune-only legacy entries on line ${lineNumber}: ${rawLine}`);
    }
  });

  allowlist.externalSources = [...externalSourcesByKey.values()].map((source) => ({
    ...source,
    skills: source.skills.sort(),
  })).sort((left, right) => left.label.localeCompare(right.label));
  allowlist.rootSkills.sort();
  allowlist.gstackSkills.sort();
  allowlist.gsdSkills.sort();

  return allowlist;
};

export const parsePruneLedgerText = (text: string): PruneLedger => {
  const ledger = emptyPruneLedger();
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      return;
    }

    const parts = line.split(/\s+/);
    const [kind] = parts as [AllowlistKind | string, ...string[]];
    if (!["legacy-skill", "legacy-command", "legacy-mimocode-command"].includes(kind)) {
      throw new Error(`default skill prune ledger must contain only legacy entries on line ${lineNumber}: ${rawLine}`);
    }

    const dedupeKey = parts.join("\0");
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);

    if (kind === "legacy-skill") {
      if (parts.length !== 2) {
        throw new Error(`invalid legacy-skill line ${lineNumber}: ${rawLine}`);
      }
      const [, skillName] = parts;
      assertSafeSkillName(skillName, lineNumber);
      pushUnique(ledger.legacySkills, skillName);
      return;
    }

    if (parts.length !== 2) {
      throw new Error(`invalid ${kind} line ${lineNumber}: ${rawLine}`);
    }
    const [, commandName] = parts;
    assertSafeCommandName(commandName, lineNumber);
    pushUnique(kind === "legacy-command" ? ledger.legacyCommands : ledger.legacyMimocodeCommands, commandName);
  });

  ledger.legacySkills.sort();
  ledger.legacyCommands.sort();
  ledger.legacyMimocodeCommands.sort();

  return ledger;
};

export const readDefaultSkillAllowlist = (path = defaultSkillAllowlistPath()): DefaultSkillAllowlist => {
  if (!existsSync(path)) {
    throw new Error(`missing default skill allowlist: ${path}`);
  }
  return parseDefaultSkillAllowlistText(readFileSync(path, "utf8"));
};

export const readPruneLedger = (path: string): PruneLedger => {
  if (!existsSync(path)) {
    throw new Error(`missing default skill prune ledger: ${path}`);
  }
  return parsePruneLedgerText(readFileSync(path, "utf8"));
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

const usage = () => {
  console.error("Usage: default-skill-allowlist.ts <validate|root-skills|check-root-skills|external-labels|external-repo|external-skill-args|gstack-skills|gsd-skills> <allowlist> [arg]");
};

const main = () => {
  const [command, allowlistPath, label] = process.argv.slice(2);
  if (!command || !allowlistPath) {
    usage();
    process.exit(2);
  }

  try {
    if (command === "validate") {
      readDefaultSkillAllowlist(allowlistPath);
      console.log("  ✓ default skill allowlist is valid");
      return;
    }

    const allowlist = readDefaultSkillAllowlist(allowlistPath);

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
