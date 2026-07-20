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
};

export type ExternalSkillSource = {
  label: string;
  repo: string;
  skills: string[];
};

export type SkillTier = "default" | "routed" | "on-demand";
export type SkillHost = "all" | "claude-code" | "codex";

export type SkillPolicy = {
  skill: string;
  tier: SkillTier;
};

export type ExternalSkillPolicy = SkillPolicy & {
  label: string;
  repo: string;
  host: SkillHost;
};

export type DefaultSkillAllowlist = {
  rootSkills: string[];
  rootSkillPolicies: SkillPolicy[];
  externalSources: ExternalSkillSource[];
  externalSkillPolicies: ExternalSkillPolicy[];
  gstackSkills: string[];
  gstackSkillPolicies: SkillPolicy[];
  gsdSkills: string[];
  gsdSkillPolicies: SkillPolicy[];
};

type InstallAllowlistKind =
  | "root-skill"
  | "external-skill"
  | "gstack-skill"
  | "gsd-skill";

type PruneLedgerKind =
  | "legacy-skill"
  | "legacy-command";

const skillNamePattern = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
const labelPattern = /^[a-z][a-z0-9-]*$/;
const repoSlugPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const githubUrlPattern = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/;
const commandNamePattern = /^[A-Za-z0-9_.-]+\.md$/;
const skillTiers = ["default", "routed", "on-demand"] as const;
const skillHosts = ["all", "claude-code", "codex"] as const;

export const defaultSkillAllowlistPath = (cwd = process.cwd()) => join(cwd, "scripts", "default-skill-allowlist.txt");

const emptyAllowlist = (): DefaultSkillAllowlist => ({
  rootSkills: [],
  rootSkillPolicies: [],
  externalSources: [],
  externalSkillPolicies: [],
  gstackSkills: [],
  gstackSkillPolicies: [],
  gsdSkills: [],
  gsdSkillPolicies: [],
});

const emptyPruneLedger = (): PruneLedger => ({
  legacySkills: [],
  legacyCommands: [],
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

const assertSkillTier = (value: string, lineNumber: number): SkillTier => {
  if (!skillTiers.includes(value as SkillTier)) {
    throw new Error(`invalid skill tier on line ${lineNumber}: ${value}`);
  }
  return value as SkillTier;
};

const assertSkillHost = (value: string, lineNumber: number): SkillHost => {
  if (!skillHosts.includes(value as SkillHost)) {
    throw new Error(`invalid skill host on line ${lineNumber}: ${value}`);
  }
  return value as SkillHost;
};

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
    const [kind] = parts as [InstallAllowlistKind | PruneLedgerKind | string, ...string[]];
    if (![
      "root-skill",
      "external-skill",
      "gstack-skill",
      "gsd-skill",
      "legacy-skill",
      "legacy-command",
    ].includes(kind)) {
      throw new Error(`unknown default skill allowlist kind on line ${lineNumber}: ${kind}`);
    }

    const dedupeKey = parts.join("\0");
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);

    if (kind === "root-skill") {
      if (parts.length !== 3) {
        throw new Error(`invalid root-skill line ${lineNumber}: ${rawLine}`);
      }
      const [, tierValue, skillName] = parts;
      const tier = assertSkillTier(tierValue, lineNumber);
      assertSafeSkillName(skillName, lineNumber);
      pushUnique(allowlist.rootSkills, skillName);
      allowlist.rootSkillPolicies.push({ skill: skillName, tier });
      return;
    }

    if (kind === "external-skill") {
      if (parts.length !== 6) {
        throw new Error(`invalid external-skill line ${lineNumber}: ${rawLine}`);
      }
      const [, tierValue, hostValue, label, repo, skillName] = parts;
      const tier = assertSkillTier(tierValue, lineNumber);
      const host = assertSkillHost(hostValue, lineNumber);
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
      allowlist.externalSkillPolicies.push({ label, repo, skill: skillName, tier, host });
      return;
    }

    if (kind === "gstack-skill") {
      if (parts.length !== 3) {
        throw new Error(`invalid gstack-skill line ${lineNumber}: ${rawLine}`);
      }
      const [, tierValue, skillName] = parts;
      const tier = assertSkillTier(tierValue, lineNumber);
      assertSafeSkillName(skillName, lineNumber);
      pushUnique(allowlist.gstackSkills, skillName);
      allowlist.gstackSkillPolicies.push({ skill: skillName, tier });
      return;
    }

    if (kind === "gsd-skill") {
      if (parts.length !== 3) {
        throw new Error(`invalid gsd-skill line ${lineNumber}: ${rawLine}`);
      }
      const [, tierValue, skillName] = parts;
      const tier = assertSkillTier(tierValue, lineNumber);
      assertSafeSkillName(skillName, lineNumber);
      pushUnique(allowlist.gsdSkills, skillName);
      allowlist.gsdSkillPolicies.push({ skill: skillName, tier });
      return;
    }

    if (kind === "legacy-skill") {
      throw new Error(`default skill allowlist must not contain prune-only legacy entries on line ${lineNumber}: ${rawLine}`);
    }

    if (kind === "legacy-command") {
      throw new Error(`default skill allowlist must not contain prune-only legacy entries on line ${lineNumber}: ${rawLine}`);
    }
  });

  const portfolioOwners = new Map<string, string>();
  const registerOwner = (skill: string, owner: string) => {
    const previous = portfolioOwners.get(skill);
    if (previous && previous !== owner) {
      throw new Error(`managed skill name collision: ${skill} (${previous}, ${owner})`);
    }
    portfolioOwners.set(skill, owner);
  };
  for (const policy of allowlist.rootSkillPolicies) registerOwner(policy.skill, `root:${policy.tier}`);
  for (const policy of allowlist.externalSkillPolicies) {
    registerOwner(policy.skill, `external:${policy.label}:${policy.tier}:${policy.host}`);
  }
  for (const policy of allowlist.gstackSkillPolicies) registerOwner(policy.skill, `gstack:${policy.tier}`);
  for (const policy of allowlist.gsdSkillPolicies) registerOwner(policy.skill, `gsd:${policy.tier}`);

  allowlist.externalSources = [...externalSourcesByKey.values()].map((source) => ({
    ...source,
    skills: source.skills.sort(),
  })).sort((left, right) => left.label.localeCompare(right.label));
  allowlist.rootSkills.sort();
  allowlist.rootSkillPolicies.sort((left, right) => left.skill.localeCompare(right.skill));
  allowlist.externalSkillPolicies.sort((left, right) => left.skill.localeCompare(right.skill));
  allowlist.gstackSkills.sort();
  allowlist.gstackSkillPolicies.sort((left, right) => left.skill.localeCompare(right.skill));
  allowlist.gsdSkills.sort();
  allowlist.gsdSkillPolicies.sort((left, right) => left.skill.localeCompare(right.skill));

  return allowlist;
};

const selectedOnDemandSkills = (allowlist: DefaultSkillAllowlist): Set<string> => {
  const selected = new Set((process.env.INTUITIVE_FLOW_ON_DEMAND_SKILLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean));
  const known = new Set([
    ...allowlist.rootSkills,
    ...allowlist.externalSources.flatMap((source) => source.skills),
    ...allowlist.gstackSkills,
    ...allowlist.gsdSkills,
  ]);
  for (const skill of selected) {
    if (!known.has(skill)) {
      throw new Error(`unknown on-demand skill: ${skill}`);
    }
  }
  return selected;
};

const policyIsInstalled = (policy: SkillPolicy, selected: Set<string>) => (
  policy.tier !== "on-demand" || selected.has(policy.skill)
);

export const rootSkillsForInstall = (allowlist: DefaultSkillAllowlist): string[] => (
  allowlist.rootSkillPolicies.filter((policy) => policyIsInstalled(policy, selectedOnDemandSkills(allowlist)))
    .map((policy) => policy.skill)
);

export const gstackSkillsForInstall = (allowlist: DefaultSkillAllowlist): string[] => (
  allowlist.gstackSkillPolicies.filter((policy) => policyIsInstalled(policy, selectedOnDemandSkills(allowlist)))
    .map((policy) => policy.skill)
);

export const gsdSkillsForInstall = (allowlist: DefaultSkillAllowlist): string[] => (
  allowlist.gsdSkillPolicies.filter((policy) => policyIsInstalled(policy, selectedOnDemandSkills(allowlist)))
    .map((policy) => policy.skill)
);

export const externalSourcesForInstall = (
  allowlist: DefaultSkillAllowlist,
  host?: SkillHost,
): ExternalSkillSource[] => {
  const selected = selectedOnDemandSkills(allowlist);
  const sources = new Map<string, ExternalSkillSource>();
  for (const policy of allowlist.externalSkillPolicies) {
    if (!policyIsInstalled(policy, selected) || (host && policy.host !== "all" && policy.host !== host)) {
      continue;
    }
    const key = sourceKey(policy.label, policy.repo);
    const source = sources.get(key) ?? { label: policy.label, repo: policy.repo, skills: [] };
    pushUnique(source.skills, policy.skill);
    sources.set(key, source);
  }
  return [...sources.values()].map((source) => ({ ...source, skills: source.skills.sort() }))
    .sort((left, right) => left.label.localeCompare(right.label));
};

export const hostScopedExternalSkillsForInstall = (
  allowlist: DefaultSkillAllowlist,
  label: string,
  host: SkillHost,
): string[] => {
  const selected = selectedOnDemandSkills(allowlist);
  return allowlist.externalSkillPolicies
    .filter((policy) => policy.label === label && policy.host === host && policyIsInstalled(policy, selected))
    .map((policy) => policy.skill)
    .sort();
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
    const [kind] = parts as [PruneLedgerKind | string, ...string[]];
    if (!["legacy-skill", "legacy-command"].includes(kind)) {
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
    pushUnique(ledger.legacyCommands, commandName);
  });

  ledger.legacySkills.sort();
  ledger.legacyCommands.sort();

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

export const externalSkillSourceByLabel = (
  allowlist: DefaultSkillAllowlist,
  label: string,
  host?: SkillHost,
): ExternalSkillSource => {
  const sources = host ? externalSourcesForInstall(allowlist, host) : allowlist.externalSources;
  const source = sources.find((candidate) => candidate.label === label);
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
  console.error("Usage: default-skill-allowlist.ts <validate|root-skills|check-root-skills|external-labels|external-repo|external-skill-args|external-host-scoped-skills|gstack-skills|gsd-skills> <allowlist> [label|host] [host]");
};

const main = () => {
  const [command, allowlistPath, label, hostValue] = process.argv.slice(2);
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
      console.log(rootSkillsForInstall(allowlist).join("\n"));
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
      const host = label ? assertSkillHost(label, 0) : undefined;
      console.log(externalSourcesForInstall(allowlist, host).map((source) => source.label).join("\n"));
      return;
    }

    if (command === "gstack-skills") {
      console.log(gstackSkillsForInstall(allowlist).join("\n"));
      return;
    }

    if (command === "gsd-skills") {
      console.log(gsdSkillsForInstall(allowlist).join("\n"));
      return;
    }

    if (!label) {
      usage();
      process.exit(2);
    }

    const host = hostValue ? assertSkillHost(hostValue, 0) : undefined;
    if (command === "external-host-scoped-skills") {
      if (!host) {
        usage();
        process.exit(2);
      }
      console.log(hostScopedExternalSkillsForInstall(allowlist, label, host).join("\n"));
      return;
    }
    const source = externalSkillSourceByLabel(allowlist, label, host);

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
