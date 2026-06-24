#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { checkRootSkills, readDefaultSkillAllowlist, readPruneLedger } from "./default-skill-allowlist";
import { skillBlockValue, skillFrontmatter, skillFrontmatterValue } from "./skill-metadata";

export type SkillCheckOptions = {
  skillsRoot: string;
  allowlistPath: string;
  pruneLedgerPath?: string;
  deprecatedSourceRoot: string;
  gstackCodexSkillsRoot?: string;
  packageJsonPath?: string;
  githubVerifyWorkflowPath?: string;
  skillSizeBudget?: SkillSizeBudget;
};

export type SkillSizeBudget = {
  maxChars: number;
  maxLines: number;
};

export type SkillSizeReport = {
  skillName: string;
  chars: number;
  lines: number;
  overBudget: boolean;
};

const defaultOptions = (): SkillCheckOptions => ({
  skillsRoot: join(process.cwd(), "skills"),
  allowlistPath: join(process.cwd(), "scripts", "default-skill-allowlist.txt"),
  pruneLedgerPath: join(process.cwd(), "scripts", "default-skill-prune-ledger.txt"),
  deprecatedSourceRoot: join(process.cwd(), "skills-src"),
  gstackCodexSkillsRoot: join(process.cwd(), "vendor", "gstack", ".agents", "skills"),
  packageJsonPath: join(process.cwd(), "package.json"),
  githubVerifyWorkflowPath: join(process.cwd(), ".github", "workflows", "verify.yml"),
  skillSizeBudget: {
    maxChars: 18_000,
    maxLines: 300,
  },
});

const sortedDirEntries = (dir: string) => readdirSync(dir).sort((a, b) => a.localeCompare(b));

const listFiles = (dir: string, prefix = ""): string[] => {
  if (!existsSync(dir)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of sortedDirEntries(dir)) {
    const fullPath = join(dir, entry);
    const relativePath = prefix === "" ? entry : `${prefix}/${entry}`;
    if (statSync(fullPath).isDirectory()) {
      files.push(...listFiles(fullPath, relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
};

const skillNames = (skillsRoot: string): string[] => {
  if (!existsSync(skillsRoot)) {
    return [];
  }

  return sortedDirEntries(skillsRoot).filter((entry) => {
    const skillDir = join(skillsRoot, entry);
    return statSync(skillDir).isDirectory() && existsSync(join(skillDir, "SKILL.md"));
  });
};

type ResourceMention = {
  displayPath: string;
  resolvedPath: string;
};

const stripMarkdownTargetSuffix = (target: string): string =>
  target.split("#", 1)[0]?.split("?", 1)[0] ?? "";

const normalizeMention = (mention: string): string =>
  stripMarkdownTargetSuffix(mention)
    .replace(/[),.;:]+$/g, "")
    .replace(/^["'`]+|["'`]+$/g, "");

const skillRelativePath = (path: string): string => normalize(path).replace(/\\/g, "/");

const isMarkdownFile = (file: string): boolean => file.endsWith(".md");

const requiredWorkflowMarkers: Record<string, string[]> = {
  "agent-planning-loop": ["Plan artifact:", "Recommended next action:", "Shortcut:"],
  "grill-with-docs-batch": ["Plan state:", "Recommended next action:", "Shortcut:"],
  "intuitive-flow": ["Proof", "What changed", "Scope changes", "Parked todos"],
  "intuitive-preflight": ["To execute:", "Optional tracking:", "Approval:"],
  "intuitive-reduce-entropy": ["Recommended next action:", "Shortcut:"],
};

const localResourceMentions = (text: string, sourceFile: string): ResourceMention[] => {
  const mentions = new Map<string, ResourceMention>();
  const addMention = (displayPath: string, resolvedPath = displayPath) => {
    if (displayPath === "") {
      return;
    }

    mentions.set(`${displayPath}:${resolvedPath}`, { displayPath, resolvedPath });
  };

  const resolveMention = (mention: string): string => {
    if (mention.startsWith("./") || mention.startsWith("../")) {
      return skillRelativePath(join(dirname(sourceFile), mention));
    }
    return mention;
  };

  const resourcePattern = /(?<![A-Za-z0-9_/-])((?:references|templates)\/[A-Za-z0-9._/-]+|(?:\.\.\/)+_shared\/[A-Za-z0-9._/-]+)\.[A-Za-z0-9]+/g;
  for (const match of text.matchAll(resourcePattern)) {
    const mention = normalizeMention(match[0]);
    addMention(mention, resolveMention(mention));
  }
  const markdownLinkPattern = /\[[^\]]*]\(([^)]+)\)/g;
  for (const match of text.matchAll(markdownLinkPattern)) {
    const target = match[1]?.trim();
    if (
      target &&
      !target.startsWith("#") &&
      !target.startsWith("http://") &&
      !target.startsWith("https://") &&
      !target.startsWith("/")
    ) {
      const mention = normalizeMention(target);
      if (mention === "" || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(mention)) {
        continue;
      }
      const resolvedPath = skillRelativePath(join(dirname(sourceFile), mention));
      addMention(resolvedPath, resolvedPath);
    }
  }
  return [...mentions.values()].sort((a, b) => a.displayPath.localeCompare(b.displayPath));
};

const checkSkill = (skillsRoot: string, skillName: string, projectRoot: string): string[] => {
  const errors: string[] = [];
  const skillDir = join(skillsRoot, skillName);
  const skillPath = join(skillDir, "SKILL.md");
  const text = readFileSync(skillPath, "utf8");
  const header = skillFrontmatter(text);

  if (!header) {
    errors.push(`missing frontmatter: skills/${skillName}/SKILL.md`);
  } else {
    const name = skillFrontmatterValue(header, "name");
    if (name !== skillName) {
      errors.push(`frontmatter name mismatch in skills/${skillName}/SKILL.md: expected ${skillName}, got ${name ?? "<missing>"}`);
    }

    const description = skillBlockValue(header, "description");
    if (description.length === 0) {
      errors.push(`missing description in skills/${skillName}/SKILL.md`);
    } else if (description.length > 1024) {
      errors.push(`description too long in skills/${skillName}/SKILL.md: ${description.length} chars`);
    }
  }

  for (const file of listFiles(skillDir)) {
    const filePath = join(skillDir, file);
    const fileText = readFileSync(filePath, "utf8");
    if (isMarkdownFile(file) && file !== "SKILL.md" && skillFrontmatter(fileText)) {
      errors.push(`non-entrypoint markdown must not have skill frontmatter: skills/${skillName}/${file}`);
    }
    if (fileText.includes("{{>")) {
      errors.push(`template include left in canonical skill file: skills/${skillName}/${file}`);
    }
    if (isMarkdownFile(file) && fileText.includes(projectRoot)) {
      errors.push(`machine-local checkout path in canonical skill file: skills/${skillName}/${file}`);
    }

    if (isMarkdownFile(file)) {
      for (const mention of localResourceMentions(fileText, file)) {
        if (!existsSync(join(skillDir, mention.resolvedPath))) {
          errors.push(`missing referenced skill resource in skills/${skillName}/${file}: ${mention.displayPath}`);
        }
      }
    }
  }

  const markers = requiredWorkflowMarkers[skillName] ?? [];
  for (const marker of markers) {
    if (!text.includes(marker)) {
      errors.push(`missing workflow handoff marker in skills/${skillName}/SKILL.md: ${marker}`);
    }
  }

  return errors;
};

const packageManagerBunVersion = (packageJsonPath: string): string | undefined => {
  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { packageManager?: unknown };
    if (typeof parsed.packageManager !== "string") {
      return undefined;
    }

    const match = /^bun@(.+)$/.exec(parsed.packageManager.trim());
    return match?.[1];
  } catch {
    return undefined;
  }
};

const githubActionsBunVersion = (workflowPath: string): string | undefined => {
  try {
    const text = readFileSync(workflowPath, "utf8");
    const match = /^\s*bun-version:\s*["']?([^"'\s#]+)["']?\s*$/m.exec(text);
    return match?.[1];
  } catch {
    return undefined;
  }
};

const checkToolingVersions = (options: SkillCheckOptions): string[] => {
  const errors: string[] = [];
  if (!options.packageJsonPath || !options.githubVerifyWorkflowPath) {
    return errors;
  }

  const packageBunVersion = packageManagerBunVersion(options.packageJsonPath);
  const workflowBunVersion = githubActionsBunVersion(options.githubVerifyWorkflowPath);
  if (!packageBunVersion && workflowBunVersion) {
    errors.push(
      `GitHub Actions pins Bun ${workflowBunVersion} but package.json does not declare packageManager: bun@<version>`,
    );
  } else if (packageBunVersion && workflowBunVersion && packageBunVersion !== workflowBunVersion) {
    errors.push(
      `GitHub Actions Bun version drift: package.json packageManager pins bun@${packageBunVersion} but .github/workflows/verify.yml uses bun-version ${workflowBunVersion}`,
    );
  }

  return errors;
};

const checkManagedGstackSkills = (allowlist: ReturnType<typeof readDefaultSkillAllowlist>, root: string | undefined): string[] => {
  const errors: string[] = [];
  if (!root || !existsSync(root)) {
    return errors;
  }

  for (const skillName of allowlist.gstackSkills) {
    if (!existsSync(join(root, skillName, "SKILL.md"))) {
      errors.push(`default allowlist lists missing vendored GStack skill: ${skillName}`);
    }
  }

  return errors;
};

const listIntersection = (left: string[], right: string[]): string[] => {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).sort();
};

const liveSkillNames = (allowlist: ReturnType<typeof readDefaultSkillAllowlist>): string[] => [
  ...allowlist.rootSkills,
  ...allowlist.externalSources.flatMap((source) => source.skills),
  ...allowlist.gstackSkills,
  ...allowlist.gsdSkills,
];

const liveCommandNames = (allowlist: ReturnType<typeof readDefaultSkillAllowlist>): string[] => [
  ...allowlist.rootSkills.map((skillName) => `${skillName}.md`),
  ...allowlist.gstackSkills.map((skillName) => `${skillName}.md`),
  ...allowlist.gsdSkills.map((skillName) => `${skillName}.md`),
];

const checkPruneLedger = (
  allowlist: ReturnType<typeof readDefaultSkillAllowlist>,
  allowlistPath: string,
  pruneLedgerPath: string | undefined,
): string[] => {
  const errors: string[] = [];
  if (!pruneLedgerPath || !existsSync(pruneLedgerPath)) {
    return errors;
  }

  let pruneLedger;
  try {
    pruneLedger = readPruneLedger(pruneLedgerPath);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return errors;
  }

  const currentLegacySkills = listIntersection(pruneLedger.legacySkills, liveSkillNames(allowlist));
  if (currentLegacySkills.length > 0) {
    errors.push(`prune ledger lists current skill as legacy: ${currentLegacySkills.join(", ")}`);
  }

  const currentLegacyCommands = listIntersection(pruneLedger.legacyCommands, liveCommandNames(allowlist));
  if (currentLegacyCommands.length > 0) {
    errors.push(`prune ledger lists current command as legacy: ${currentLegacyCommands.join(", ")}`);
  }

  if (allowlistPath === pruneLedgerPath) {
    errors.push("default skill allowlist and prune ledger must be separate files");
  }

  return errors;
};

export const skillSizeReport = (
  skillsRoot: string,
  budget: SkillSizeBudget = { maxChars: 18_000, maxLines: 300 },
): SkillSizeReport[] =>
  skillNames(skillsRoot)
    .map((skillName) => {
      const text = readFileSync(join(skillsRoot, skillName, "SKILL.md"), "utf8");
      const chars = text.length;
      const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
      return {
        skillName,
        chars,
        lines,
        overBudget: chars > budget.maxChars || lines > budget.maxLines,
      };
    })
    .sort((a, b) => b.chars - a.chars || a.skillName.localeCompare(b.skillName));

export const checkSkills = (options = defaultOptions()): string[] => {
  const errors: string[] = [];
  const projectRoot = dirname(options.skillsRoot);

  if (existsSync(options.deprecatedSourceRoot) && listFiles(options.deprecatedSourceRoot).length > 0) {
    errors.push("deprecated generated skill source remains: skills-src/");
  }

  if (!existsSync(options.skillsRoot)) {
    errors.push("missing skills directory: skills/");
    return errors;
  }

  if (!existsSync(options.allowlistPath)) {
    errors.push("missing default skill allowlist: scripts/default-skill-allowlist.txt");
    return errors;
  }

  let allowlist;
  try {
    allowlist = readDefaultSkillAllowlist(options.allowlistPath);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return errors;
  }
  errors.push(...checkRootSkills(allowlist, options.skillsRoot));
  errors.push(...checkPruneLedger(allowlist, options.allowlistPath, options.pruneLedgerPath));

  for (const skillName of skillNames(options.skillsRoot)) {
    errors.push(...checkSkill(options.skillsRoot, skillName, projectRoot));
  }

  errors.push(...checkToolingVersions(options));
  errors.push(...checkManagedGstackSkills(allowlist, options.gstackCodexSkillsRoot));

  return errors;
};

const main = () => {
  const options = defaultOptions();
  const errors = checkSkills(options);
  for (const error of errors) {
    console.error(`  ! ${error}`);
  }
  if (errors.length > 0) {
    process.exit(1);
  }
  const budget = options.skillSizeBudget;
  if (budget) {
    const report = skillSizeReport(options.skillsRoot, budget);
    const overBudget = report.filter((item) => item.overBudget);
    const summary = report
      .slice(0, 5)
      .map((item) => `${item.skillName}=${item.lines}l/${item.chars}c`)
      .join(", ");
    console.log(
      `  skill size budget: ${overBudget.length}/${report.length} over ${budget.maxLines} lines or ${budget.maxChars} chars`,
    );
    if (summary) {
      console.log(`  largest skill entrypoints: ${summary}`);
    }
  }
  console.log("  ✓ skills are structurally valid");
};

if (import.meta.main) {
  main();
}
