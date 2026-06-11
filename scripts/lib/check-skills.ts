#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { checkRootSkills, readDefaultSkillAllowlist } from "./default-skill-allowlist";

export type SkillCheckOptions = {
  skillsRoot: string;
  allowlistPath: string;
  deprecatedSourceRoot: string;
  packageJsonPath?: string;
  githubVerifyWorkflowPath?: string;
};

const defaultOptions = (): SkillCheckOptions => ({
  skillsRoot: join(process.cwd(), "skills"),
  allowlistPath: join(process.cwd(), "scripts", "default-skill-allowlist.txt"),
  deprecatedSourceRoot: join(process.cwd(), "skills-src"),
  packageJsonPath: join(process.cwd(), "package.json"),
  githubVerifyWorkflowPath: join(process.cwd(), ".github", "workflows", "verify.yml"),
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

const frontmatter = (text: string): string | undefined => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  return match?.[1];
};

const frontmatterValue = (frontmatterText: string, key: string): string | undefined => {
  const match = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(frontmatterText);
  return match?.[1]?.trim().replace(/^["']|["']$/g, "");
};

const blockValue = (frontmatterText: string, key: string): string => {
  const lines = frontmatterText.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start === -1) {
    return "";
  }

  const first = lines[start].slice(`${key}:`.length).trim();
  if (first !== "|" && first !== ">") {
    return first;
  }

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Za-z0-9_-]+:\s*/.test(line)) {
      break;
    }
    body.push(line.replace(/^ {2}/, ""));
  }
  return body.join("\n").trim();
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
const localCheckoutPathPattern = /\/home\/mi\/ws\/intuitive-flow\b/;

const localResourceMentions = (text: string, sourceFile: string): ResourceMention[] => {
  const mentions = new Map<string, ResourceMention>();
  const addMention = (displayPath: string, resolvedPath = displayPath) => {
    if (displayPath === "") {
      return;
    }

    mentions.set(`${displayPath}:${resolvedPath}`, { displayPath, resolvedPath });
  };

  const resourcePattern = /\b(?:references|templates)\/[A-Za-z0-9._/-]+\.[A-Za-z0-9]+/g;
  for (const match of text.matchAll(resourcePattern)) {
    const mention = normalizeMention(match[0]);
    addMention(mention);
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

const checkSkill = (skillsRoot: string, skillName: string): string[] => {
  const errors: string[] = [];
  const skillDir = join(skillsRoot, skillName);
  const skillPath = join(skillDir, "SKILL.md");
  const text = readFileSync(skillPath, "utf8");
  const header = frontmatter(text);

  if (!header) {
    errors.push(`missing frontmatter: skills/${skillName}/SKILL.md`);
  } else {
    const name = frontmatterValue(header, "name");
    if (name !== skillName) {
      errors.push(`frontmatter name mismatch in skills/${skillName}/SKILL.md: expected ${skillName}, got ${name ?? "<missing>"}`);
    }

    const description = blockValue(header, "description");
    if (description.length === 0) {
      errors.push(`missing description in skills/${skillName}/SKILL.md`);
    } else if (description.length > 1024) {
      errors.push(`description too long in skills/${skillName}/SKILL.md: ${description.length} chars`);
    }
  }

  for (const file of listFiles(skillDir)) {
    const filePath = join(skillDir, file);
    const fileText = readFileSync(filePath, "utf8");
    if (fileText.includes("{{>")) {
      errors.push(`template include left in canonical skill file: skills/${skillName}/${file}`);
    }
    if (isMarkdownFile(file) && localCheckoutPathPattern.test(fileText)) {
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

export const checkSkills = (options = defaultOptions()): string[] => {
  const errors: string[] = [];

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

  for (const skillName of skillNames(options.skillsRoot)) {
    errors.push(...checkSkill(options.skillsRoot, skillName));
  }

  errors.push(...checkToolingVersions(options));

  return errors;
};

const main = () => {
  const errors = checkSkills();
  for (const error of errors) {
    console.error(`  ! ${error}`);
  }
  if (errors.length > 0) {
    process.exit(1);
  }
  console.log("  ✓ skills are structurally valid");
};

if (import.meta.main) {
  main();
}
