#!/usr/bin/env bun

import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { readDefaultSkillAllowlist, type DefaultSkillAllowlist } from "./default-skill-allowlist";

export type DiscoveredSkill = {
  name: string;
  description: string;
  path: string;
};

export type UpstreamAuditSource = {
  label: string;
  repo: string;
  allowlisted: string[];
  discovered: DiscoveredSkill[];
  unavailable?: string;
};

export type UpstreamAudit = {
  sources: UpstreamAuditSource[];
};

type FormatAuditOptions = {
  maxCandidatesPerSource?: number;
  maxDescriptionChars?: number;
};

type AuditOptions = {
  sourceDirs: Map<string, string>;
  includeGstack: boolean;
  repoRoot: string;
  noClone: boolean;
};

const githubCloneUrl = (repo: string) => {
  if (repo.startsWith("https://github.com/")) {
    return repo.endsWith(".git") ? repo : `${repo}.git`;
  }
  return `https://github.com/${repo}.git`;
};

const frontmatter = (text: string): string | undefined => /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1];

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
    return first.replace(/^["']|["']$/g, "");
  }

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Za-z0-9_-]+:\s*/.test(line)) {
      break;
    }
    body.push(line.replace(/^ {2}/, ""));
  }
  return body.join(" ").replace(/\s+/g, " ").trim();
};

const listSkillFiles = (dir: string, prefix = ""): string[] => {
  const ownSkillPath = join(dir, "SKILL.md");
  try {
    if (statSync(ownSkillPath).isFile()) {
      return [prefix === "" ? "SKILL.md" : `${prefix}/SKILL.md`];
    }
  } catch {
    // Continue into child directories.
  }

  const files: string[] = [];
  for (const entry of readdirSync(dir).sort((left, right) => left.localeCompare(right))) {
    if (entry === ".git" || entry === "node_modules") {
      continue;
    }

    const fullPath = join(dir, entry);
    const relativePath = prefix === "" ? entry : `${prefix}/${entry}`;
    if (statSync(fullPath).isDirectory()) {
      files.push(...listSkillFiles(fullPath, relativePath));
    } else if (entry === "SKILL.md") {
      files.push(relativePath);
    }
  }
  return files;
};

type DiscoverOptions = {
  nameMode?: "frontmatter" | "directory";
};

export const discoverSkills = (sourceRoot: string, options: DiscoverOptions = {}): DiscoveredSkill[] => {
  const byName = new Map<string, DiscoveredSkill>();
  for (const skillPath of listSkillFiles(sourceRoot)) {
    const text = readFileSync(join(sourceRoot, skillPath), "utf8");
    const header = frontmatter(text);
    const name = header ? frontmatterValue(header, "name") : undefined;
    const skillName = options.nameMode === "directory" ? basename(dirname(skillPath)) : name && name.length > 0 ? name : basename(dirname(skillPath));
    const description = header ? blockValue(header, "description") : "";
    if (!byName.has(skillName)) {
      byName.set(skillName, {
        name: skillName,
        description,
        path: skillPath,
      });
    }
  }
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
};

const cloneSource = (repo: string): { path?: string; cleanup?: () => void; error?: string } => {
  const dir = mkdtempSync(join(tmpdir(), "skill-upstream-audit-"));
  const result = spawnSync("git", ["clone", "--depth", "1", "--quiet", githubCloneUrl(repo), dir], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    return { error: (result.stderr || result.stdout || `git clone failed for ${repo}`).trim() };
  }
  return {
    path: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
};

const sourceRootFor = (
  label: string,
  repo: string,
  options: AuditOptions,
): { path?: string; cleanup?: () => void; unavailable?: string } => {
  const explicit = options.sourceDirs.get(label);
  if (explicit) {
    return { path: explicit };
  }
  if (options.noClone) {
    return { unavailable: "no source directory provided and cloning disabled" };
  }
  const cloned = cloneSource(repo);
  return { path: cloned.path, cleanup: cloned.cleanup, unavailable: cloned.error };
};

export const auditSkillUpstreams = (
  allowlist: DefaultSkillAllowlist,
  options: AuditOptions,
): UpstreamAudit => {
  const sources: UpstreamAuditSource[] = [];
  const cleanup: Array<() => void> = [];

  try {
    for (const source of allowlist.externalSources) {
      const sourceRoot = sourceRootFor(source.label, source.repo, options);
      if (sourceRoot.cleanup) {
        cleanup.push(sourceRoot.cleanup);
      }
      sources.push({
        label: source.label,
        repo: source.repo,
        allowlisted: source.skills,
        discovered: sourceRoot.path ? discoverSkills(sourceRoot.path) : [],
        unavailable: sourceRoot.unavailable,
      });
    }

    if (options.includeGstack) {
      const gstackRoot = join(options.repoRoot, "vendor", "gstack", ".agents", "skills");
      try {
        if (statSync(gstackRoot).isDirectory()) {
          sources.push({
            label: "gstack",
            repo: "garrytan/gstack",
            allowlisted: allowlist.gstackSkills,
            discovered: discoverSkills(gstackRoot, { nameMode: "directory" }),
          });
        }
      } catch {
        sources.push({
          label: "gstack",
          repo: "garrytan/gstack",
          allowlisted: allowlist.gstackSkills,
          discovered: [],
          unavailable: "vendor/gstack/.agents/skills not found",
        });
      }
    }
  } finally {
    for (const dispose of cleanup) {
      dispose();
    }
  }

  return { sources };
};

const truncateText = (text: string, maxChars: number) => {
  if (maxChars <= 0 || text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
};

const formatSkill = (skill: DiscoveredSkill, maxDescriptionChars: number) => {
  const description = skill.description ? ` - ${truncateText(skill.description, maxDescriptionChars)}` : "";
  return `- \`${skill.name}\`${description} (${skill.path})`;
};

export const formatAuditMarkdown = (audit: UpstreamAudit, options: FormatAuditOptions = {}): string => {
  const maxCandidatesPerSource = options.maxCandidatesPerSource ?? 20;
  const maxDescriptionChars = options.maxDescriptionChars ?? 180;
  const lines = ["# Skill Upstream Audit", ""];
  for (const source of audit.sources) {
    const allowlisted = new Set(source.allowlisted);
    const outside = source.discovered.filter((skill) => !allowlisted.has(skill.name));
    const missing = source.allowlisted.filter((skillName) => !source.discovered.some((skill) => skill.name === skillName));
    const visibleOutside = maxCandidatesPerSource <= 0 ? outside : outside.slice(0, maxCandidatesPerSource);

    lines.push(`## ${source.label}`, "");
    lines.push(`Source: \`${source.repo}\``);
    lines.push(`Allowlisted: ${source.allowlisted.length === 0 ? "none" : source.allowlisted.map((name) => `\`${name}\``).join(", ")}`);
    if (source.unavailable) {
      lines.push(`Unavailable: ${source.unavailable}`, "");
      continue;
    }

    lines.push("");
    lines.push("Candidates outside allowlist:");
    if (outside.length === 0) {
      lines.push("- none");
    } else {
      if (visibleOutside.length < outside.length) {
        lines.push(`Showing ${visibleOutside.length} of ${outside.length}. Use \`--json\` or \`--limit 0\` for the full list.`);
      }
      lines.push(...visibleOutside.map((skill) => formatSkill(skill, maxDescriptionChars)));
    }

    lines.push("");
    lines.push("Allowlisted but not found upstream:");
    if (missing.length === 0) {
      lines.push("- none");
    } else {
      lines.push(...missing.map((skillName) => `- \`${skillName}\``));
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
};

const parseArgs = (args: string[]) => {
  let allowlistPath = "scripts/default-skill-allowlist.txt";
  let json = false;
  const sourceDirs = new Map<string, string>();
  let includeGstack = true;
  let noClone = false;
  let limit = 20;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--no-clone") {
      noClone = true;
    } else if (arg === "--no-gstack") {
      includeGstack = false;
    } else if (arg === "--allowlist") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--allowlist requires a path");
      }
      allowlistPath = value;
      index += 1;
    } else if (arg === "--limit") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--limit requires a number");
      }
      limit = Number(value);
      if (!Number.isInteger(limit) || limit < 0) {
        throw new Error("--limit must be a non-negative integer");
      }
      index += 1;
    } else if (arg === "--source-dir") {
      const value = args[index + 1];
      if (!value || !value.includes("=")) {
        throw new Error("--source-dir requires label=path");
      }
      const [label, ...pathParts] = value.split("=");
      sourceDirs.set(label, pathParts.join("="));
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  return { allowlistPath, includeGstack, json, limit, noClone, sourceDirs };
};

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2));
    const allowlist = readDefaultSkillAllowlist(args.allowlistPath);
    const audit = auditSkillUpstreams(allowlist, {
      sourceDirs: args.sourceDirs,
      includeGstack: args.includeGstack,
      noClone: args.noClone,
      repoRoot: process.cwd(),
    });
    if (args.json) {
      console.log(JSON.stringify(audit, null, 2));
    } else {
      console.log(formatAuditMarkdown(audit, { maxCandidatesPerSource: args.limit }));
    }
  } catch (error) {
    console.error(`  ! ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

if (import.meta.main) {
  main();
}
