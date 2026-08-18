import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { inspectSquash, matchesPreservePath, preserveMarkerReasons, signatureIsPresent } from "./preflight";

const git = (cwd: string, args: string[]) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
};

const commitFile = (cwd: string, path: string, content: string, message: string, author?: { name: string; email: string }) => {
  const fullPath = join(cwd, path);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content);
  git(cwd, ["add", path]);
  const authorArgs = author ? ["-c", `user.name=${author.name}`, "-c", `user.email=${author.email}`] : [];
  git(cwd, [...authorArgs, "commit", "-m", message]);
  return git(cwd, ["rev-parse", "HEAD"]);
};

describe("intuitive squash preservation rules", () => {
  test("requires explicit markers instead of ordinary prose", () => {
    expect(preserveMarkerReasons("fix: keep the process alive", "important setup note")).toEqual([]);
    expect(preserveMarkerReasons("fix: [KEEP] retain guard", "")).toContain("marker: KEEP");
    expect(preserveMarkerReasons("security: harden parser", "CVE-2026-1234")).toContain("high-risk type prefix");
    expect(preserveMarkerReasons("fix: close #42", "")).toContain("issue-closing fix");
  });

  test("matches path prefixes and globs", () => {
    expect(matchesPreservePath("security/policy.ts", ["security/"])).toBe(true);
    expect(matchesPreservePath("src/auth/token.ts", ["src/**/token.ts"])).toBe(true);
    expect(matchesPreservePath("src/auth/session.ts", ["src/**/token.ts"])).toBe(false);
    expect(matchesPreservePath("src/auth/session.ts", ["["])).toBe(false);
  });

  test("distinguishes unsigned commits from signature states", () => {
    expect(signatureIsPresent("N")).toBe(false);
    expect(signatureIsPresent("")).toBe(false);
    expect(signatureIsPresent("G")).toBe(true);
    expect(signatureIsPresent("B")).toBe(true);
  });
});

describe("intuitive squash preflight", () => {
  test("reports dirty state, publication, merges, tags, paths, and external authors", () => {
    const cwd = mkdtempSync(join(tmpdir(), "intuitive-squash-"));
    try {
      git(cwd, ["init", "-b", "main"]);
      git(cwd, ["config", "user.name", "Local User"]);
      git(cwd, ["config", "user.email", "local@example.com"]);
      mkdirSync(join(cwd, ".planning"), { recursive: true });
      writeFileSync(join(cwd, ".planning", "config.json"), JSON.stringify({ preserve_paths: ["security/"] }));
      writeFileSync(join(cwd, "README.md"), "base\n");
      git(cwd, ["add", "."]);
      git(cwd, ["commit", "-m", "base"]);
      const base = git(cwd, ["rev-parse", "HEAD"]);
      git(cwd, ["update-ref", "refs/remotes/origin/main", base]);
      git(cwd, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);

      git(cwd, ["switch", "-c", "feature"]);
      const kept = commitFile(cwd, "src/feature.ts", "feature\n", "feat: [KEEP] feature boundary");
      git(cwd, ["tag", "reviewed-feature", kept]);
      commitFile(cwd, "src/external.ts", "external\n", "feat: external contribution", {
        name: "External User",
        email: "external@example.com",
      });

      git(cwd, ["switch", "-c", "side", base]);
      commitFile(cwd, "security/policy.ts", "policy\n", "feat: policy guard");
      git(cwd, ["switch", "feature"]);
      git(cwd, ["merge", "--no-ff", "side", "-m", "merge side policy"]);
      const head = git(cwd, ["rev-parse", "HEAD"]);
      git(cwd, ["update-ref", "refs/remotes/origin/feature", head]);
      writeFileSync(join(cwd, "scratch.txt"), "dirty\n");

      const report = inspectSquash(cwd, base);
      expect(report.branch).toBe("feature");
      expect(report.head).toBe(head);
      expect(report.worktree.dirty).toBe(true);
      expect(report.worktree.untrackedCount).toBe(1);
      expect(report.publication.remoteRefs).toContain("origin/feature");
      expect(report.decisionGates.some((gate) => gate.includes("merge commit"))).toBe(true);
      expect(report.decisionGates.some((gate) => gate.includes("tagged commit"))).toBe(true);
      expect(report.commits.find((commit) => commit.oid === kept)?.preserveReasons).toContain("marker: KEEP");
      expect(report.commits.find((commit) => commit.authorEmail === "external@example.com")?.preserveReasons)
        .toContain("external author: external@example.com");
      expect(report.commits.find((commit) => commit.files.includes("security/policy.ts"))?.preserveReasons)
        .toContain("matched .planning/config.json preserve_paths");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("blocks rewriting the detected remote default branch", () => {
    const cwd = mkdtempSync(join(tmpdir(), "intuitive-squash-default-"));
    try {
      git(cwd, ["init", "-b", "main"]);
      git(cwd, ["config", "user.name", "Local User"]);
      git(cwd, ["config", "user.email", "local@example.com"]);
      commitFile(cwd, "base.txt", "base\n", "base");
      const base = git(cwd, ["rev-parse", "HEAD"]);
      commitFile(cwd, "next.txt", "next\n", "next");
      git(cwd, ["update-ref", "refs/remotes/origin/main", base]);
      git(cwd, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);

      expect(inspectSquash(cwd, base).hardStops).toContain(
        "current branch main is the detected remote default origin/main",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("uses an explicitly discovered remote default when origin HEAD is absent", () => {
    const cwd = mkdtempSync(join(tmpdir(), "intuitive-squash-default-override-"));
    try {
      git(cwd, ["init", "-b", "trunk"]);
      git(cwd, ["config", "user.name", "Local User"]);
      git(cwd, ["config", "user.email", "local@example.com"]);
      commitFile(cwd, "base.txt", "base\n", "base");
      const base = git(cwd, ["rev-parse", "HEAD"]);
      commitFile(cwd, "next.txt", "next\n", "next");

      expect(inspectSquash(cwd, base, "upstream/trunk").hardStops).toContain(
        "current branch trunk is the detected remote default upstream/trunk",
      );
      expect(inspectSquash(cwd, base, "refs/remotes/upstream/trunk").hardStops).toContain(
        "current branch trunk is the detected remote default refs/remotes/upstream/trunk",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
