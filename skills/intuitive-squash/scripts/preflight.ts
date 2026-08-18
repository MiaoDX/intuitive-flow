#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

export type CommitRecord = {
  oid: string;
  shortOid: string;
  parents: string[];
  subject: string;
  message: string;
  authorName: string;
  authorEmail: string;
  canonicalAuthorEmail: string;
  signatureStatus: string;
  files: string[];
  tags: string[];
  remoteRefs: string[];
  preserveReasons: string[];
};

export type SquashPreflight = {
  schemaVersion: 1;
  repoRoot: string;
  branch: string | null;
  head: string;
  baseRef: string;
  baseCommit: string;
  mergeBase: string;
  remoteDefault: string | null;
  configuredAuthorEmail: string | null;
  worktree: {
    dirty: boolean;
    entryCount: number;
    untrackedCount: number;
  };
  upstream: null | {
    ref: string;
    oid: string;
    ahead: number;
    behind: number;
  };
  publication: {
    publishedCommitCount: number;
    remoteRefs: string[];
  };
  commits: CommitRecord[];
  hardStops: string[];
  decisionGates: string[];
  warnings: string[];
};

type GitResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
};

const runGit = (cwd: string, args: string[], allowFailure = false): GitResult => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
  if (!output.ok && !allowFailure) {
    throw new Error((output.stderr || output.stdout || `git ${args.join(" ")} failed`).trim());
  }
  return output;
};

const gitText = (cwd: string, args: string[], allowFailure = false): string =>
  runGit(cwd, args, allowFailure).stdout.trim();

const splitLines = (value: string): string[] =>
  value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

const splitNul = (value: string): string[] =>
  value.split("\0").filter(Boolean);

const unique = (values: string[]): string[] => [...new Set(values)].sort();

const canonicalEmail = (cwd: string, name: string, email: string): string => {
  const input = `${name} <${email}>`;
  const result = runGit(cwd, ["check-mailmap", input], true);
  const normalized = result.ok ? result.stdout.trim() : input;
  return normalized.match(/<([^<>]+)>\s*$/)?.[1]?.toLowerCase() ?? email.toLowerCase();
};

export const preserveMarkerReasons = (subject: string, message: string): string[] => {
  const text = `${subject}\n${message}`;
  const reasons: string[] = [];
  if (/\bDO NOT SQUASH\b/i.test(text)) reasons.push("marker: DO NOT SQUASH");
  if (/(?:\[PRESERVE\]|\bPRESERVE(?::| -| \/))/i.test(text)) reasons.push("marker: PRESERVE");
  if (/(?:\[KEEP\]|\bKEEP(?::| -| \/))/i.test(text)) reasons.push("marker: KEEP");
  if (/(?:\[IMPORTANT\]|\bIMPORTANT:)/i.test(text)) reasons.push("risk marker: IMPORTANT");
  if (/(?:\[CRITICAL\]|\bCRITICAL:)/i.test(text)) reasons.push("risk marker: CRITICAL");
  if (/(?:\[SECURITY\]|\bSECURITY:|\bCVE-\d)/i.test(text)) reasons.push("risk marker: SECURITY");
  if (/^(?:hotfix|critical|security):/i.test(subject)) reasons.push("high-risk type prefix");
  if (/(?:^|[^A-Za-z0-9_])(?:fix(?:es)?|close[sd]?)\s*:?\s*(?:#\d+|[A-Z][A-Z0-9]+-\d+)/i.test(text)) {
    reasons.push("issue-closing fix");
  }
  return reasons;
};

export const matchesPreservePath = (file: string, patterns: string[]): boolean =>
  patterns.some((rawPattern) => {
    const pattern = rawPattern.replace(/^\.\//, "").replace(/\/$/, "");
    if (!pattern) return false;
    if (/[*?[]/.test(pattern)) {
      try {
        return new Bun.Glob(pattern).match(file);
      } catch {
        return false;
      }
    }
    return file === pattern || file.startsWith(`${pattern}/`);
  });

export const signatureIsPresent = (status: string): boolean => status !== "" && status !== "N";

const readPreservePaths = (repoRoot: string, warnings: string[]): string[] => {
  const path = resolve(repoRoot, ".planning", "config.json");
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { preserve_paths?: unknown };
    if (parsed.preserve_paths === undefined) return [];
    if (!Array.isArray(parsed.preserve_paths) || parsed.preserve_paths.some((entry) => typeof entry !== "string")) {
      warnings.push(".planning/config.json preserve_paths is not a string array; path preservation was skipped");
      return [];
    }
    return parsed.preserve_paths as string[];
  } catch (error) {
    warnings.push(`could not parse .planning/config.json: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
};

const tagsByCommit = (cwd: string): Map<string, string[]> => {
  const result = new Map<string, string[]>();
  for (const tag of splitLines(gitText(cwd, ["for-each-ref", "--format=%(refname:short)", "refs/tags"], true))) {
    const commit = gitText(cwd, ["rev-parse", "--verify", `${tag}^{commit}`], true);
    if (!commit) continue;
    result.set(commit, [...(result.get(commit) ?? []), tag]);
  }
  return result;
};

const remoteRefsContaining = (cwd: string, oid: string): string[] =>
  splitLines(gitText(cwd, [
    "for-each-ref",
    "--contains",
    oid,
    "--format=%(refname:short)",
    "refs/remotes",
  ], true)).filter((ref) => !ref.endsWith("/HEAD"));

const commitRecord = (
  cwd: string,
  oid: string,
  configuredAuthorEmail: string | null,
  preservePaths: string[],
  tags: Map<string, string[]>,
): CommitRecord => {
  const metadata = gitText(cwd, ["show", "-s", "--format=%P%x00%s%x00%B%x00%an%x00%ae%x00%G?", oid]).split("\0");
  const [parentsText = "", subject = "", message = "", authorName = "", authorEmail = "", signatureStatus = "N"] = metadata;
  const files = splitLines(gitText(cwd, ["diff-tree", "--no-commit-id", "--name-only", "-r", "-m", oid], true));
  const canonicalAuthorEmail = canonicalEmail(cwd, authorName, authorEmail);
  const preserveReasons = preserveMarkerReasons(subject, message);
  if (preservePaths.some((pattern) => files.some((file) => matchesPreservePath(file, [pattern])))) {
    preserveReasons.push("matched .planning/config.json preserve_paths");
  }
  if (configuredAuthorEmail && canonicalAuthorEmail !== configuredAuthorEmail) {
    preserveReasons.push(`external author: ${authorEmail}`);
  }
  const remoteRefs = remoteRefsContaining(cwd, oid);
  return {
    oid,
    shortOid: oid.slice(0, 12),
    parents: parentsText.split(" ").filter(Boolean),
    subject,
    message: message.trim(),
    authorName,
    authorEmail,
    canonicalAuthorEmail,
    signatureStatus,
    files: unique(files),
    tags: unique(tags.get(oid) ?? []),
    remoteRefs: unique(remoteRefs),
    preserveReasons: unique(preserveReasons),
  };
};

export const inspectSquash = (
  startDir: string,
  baseRef: string,
  remoteDefaultOverride?: string,
): SquashPreflight => {
  const repoRoot = gitText(startDir, ["rev-parse", "--show-toplevel"]);
  const head = gitText(repoRoot, ["rev-parse", "HEAD"]);
  const branchResult = runGit(repoRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], true);
  const branch = branchResult.ok ? branchResult.stdout.trim() : null;
  const baseCommit = gitText(repoRoot, ["rev-parse", "--verify", `${baseRef}^{commit}`]);
  const mergeBase = gitText(repoRoot, ["merge-base", "HEAD", baseCommit]);
  const warnings: string[] = [];
  const preservePaths = readPreservePaths(repoRoot, warnings);
  const configuredName = gitText(repoRoot, ["config", "--get", "user.name"], true);
  const configuredEmailRaw = gitText(repoRoot, ["config", "--get", "user.email"], true);
  const configuredAuthorEmail = configuredEmailRaw
    ? canonicalEmail(repoRoot, configuredName, configuredEmailRaw)
    : null;
  if (!configuredAuthorEmail) warnings.push("git user.email is unset; external-author preservation could not be classified");

  const commitOids = splitLines(gitText(repoRoot, ["rev-list", "--reverse", "--topo-order", `${mergeBase}..HEAD`], true));
  const tags = tagsByCommit(repoRoot);
  const commits = commitOids.map((oid) => commitRecord(repoRoot, oid, configuredAuthorEmail, preservePaths, tags));
  const statusResult = runGit(repoRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], true);
  const statusEntries = splitNul(statusResult.stdout);
  const untrackedCount = statusEntries.filter((entry) => entry.startsWith("?? ")).length;

  const upstreamResult = runGit(repoRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], true);
  let upstream: SquashPreflight["upstream"] = null;
  if (upstreamResult.ok) {
    const ref = upstreamResult.stdout.trim();
    const oid = gitText(repoRoot, ["rev-parse", ref]);
    const counts = gitText(repoRoot, ["rev-list", "--left-right", "--count", `${ref}...HEAD`]).split(/\s+/).map(Number);
    upstream = { ref, oid, behind: counts[0] ?? 0, ahead: counts[1] ?? 0 };
  }

  const remoteDefaultResult = runGit(repoRoot, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], true);
  const remoteDefault = remoteDefaultOverride ?? (remoteDefaultResult.ok ? remoteDefaultResult.stdout.trim() : null);
  const publishedCommits = commits.filter((commit) => commit.remoteRefs.length > 0);
  const publicationRefs = unique(publishedCommits.flatMap((commit) => commit.remoteRefs));
  const mergeCommits = commits.filter((commit) => commit.parents.length > 1);
  const signedCommits = commits.filter((commit) => signatureIsPresent(commit.signatureStatus));
  const taggedCommits = commits.filter((commit) => commit.tags.length > 0);
  const hardStops: string[] = [];
  const decisionGates: string[] = [];
  const remoteDefaultBranch = remoteDefault
    ? remoteDefault.replace(/^refs\/remotes\//, "").split("/").slice(1).join("/") || remoteDefault
    : null;

  if (!branch) hardStops.push("HEAD is detached");
  if (commits.length === 0) hardStops.push("the selected range contains no commits");
  if (branch && remoteDefault && remoteDefaultBranch === branch) {
    hardStops.push(`current branch ${branch} is the detected remote default ${remoteDefault}`);
  }
  if (publicationRefs.length > 0) {
    decisionGates.push(`${publishedCommits.length} commit(s) are published on: ${publicationRefs.join(", ")}`);
  }
  if (mergeCommits.length > 0) decisionGates.push(`${mergeCommits.length} merge commit(s) require a topology decision`);
  if (signedCommits.length > 0) decisionGates.push(`${signedCommits.length} signed commit(s) require a signature strategy`);
  if (taggedCommits.length > 0) {
    decisionGates.push(`${taggedCommits.length} tagged commit(s) require an explicit tag strategy: ${unique(taggedCommits.flatMap((commit) => commit.tags)).join(", ")}`);
  }

  return {
    schemaVersion: 1,
    repoRoot,
    branch,
    head,
    baseRef,
    baseCommit,
    mergeBase,
    remoteDefault,
    configuredAuthorEmail,
    worktree: { dirty: statusEntries.length > 0, entryCount: statusEntries.length, untrackedCount },
    upstream,
    publication: { publishedCommitCount: publishedCommits.length, remoteRefs: publicationRefs },
    commits,
    hardStops,
    decisionGates,
    warnings,
  };
};

const render = (report: SquashPreflight): string => {
  const lines = [
    "# Intuitive Squash Preflight",
    `repo: ${report.repoRoot}`,
    `branch: ${report.branch ?? "DETACHED"}`,
    `head: ${report.head}`,
    `base: ${report.baseRef} (${report.baseCommit})`,
    `merge_base: ${report.mergeBase}`,
    `commits: ${report.commits.length}`,
    `worktree: ${report.worktree.dirty ? "dirty" : "clean"} (${report.worktree.entryCount} entries, ${report.worktree.untrackedCount} untracked)`,
    `upstream: ${report.upstream ? `${report.upstream.ref} (ahead ${report.upstream.ahead}, behind ${report.upstream.behind})` : "none"}`,
    `published: ${report.publication.publishedCommitCount} commit(s) on ${report.publication.remoteRefs.join(", ") || "no remote refs"}`,
  ];
  if (report.hardStops.length > 0) lines.push("", "## Hard Stops", ...report.hardStops.map((item) => `- ${item}`));
  if (report.decisionGates.length > 0) lines.push("", "## Decision Gates", ...report.decisionGates.map((item) => `- ${item}`));
  if (report.warnings.length > 0) lines.push("", "## Warnings", ...report.warnings.map((item) => `- ${item}`));
  lines.push("", "## Commits");
  for (const commit of report.commits) {
    const flags = [
      commit.parents.length > 1 ? "MERGE" : "",
      signatureIsPresent(commit.signatureStatus) ? `SIGNED:${commit.signatureStatus}` : "",
      commit.tags.length > 0 ? `TAGS:${commit.tags.join(",")}` : "",
      commit.remoteRefs.length > 0 ? `PUBLISHED:${commit.remoteRefs.join(",")}` : "",
      commit.preserveReasons.length > 0 ? `PRESERVED:${commit.preserveReasons.join("; ")}` : "",
    ].filter(Boolean);
    lines.push(`- ${commit.shortOid} ${commit.subject}${flags.length > 0 ? ` [${flags.join(" | ")}]` : ""}`);
    lines.push(`  author: ${commit.authorName} <${commit.authorEmail}>`);
    lines.push(`  paths: ${commit.files.join(", ") || "(none)"}`);
  }
  return `${lines.join("\n")}\n`;
};

const usage = () => "Usage: preflight.ts <base-ref> [--remote-default <ref>] [--json]";

if (import.meta.main) {
  const args = process.argv.slice(2);
  let json = false;
  let remoteDefault: string | undefined;
  let baseRef: string | undefined;
  let invalid = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--json") {
      json = true;
    } else if (arg === "--remote-default") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        invalid = true;
      } else {
        remoteDefault = value;
        index += 1;
      }
    } else if (arg.startsWith("-") || baseRef) {
      invalid = true;
    } else {
      baseRef = arg;
    }
  }
  if (invalid || !baseRef) {
    console.error(usage());
    process.exit(2);
  }
  try {
    const report = inspectSquash(process.cwd(), baseRef, remoteDefault);
    process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : render(report));
    process.exit(report.hardStops.length > 0 ? 3 : 0);
  } catch (error) {
    console.error(`preflight failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
