import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import type { CandidateScorecard } from "./plan_bakeoff_report";
import { slug } from "./plan_bakeoff_manifest";

export const createRunDir = (runRoot: string, targetRepo: string): string => {
  mkdirSync(runRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return mkdtempSync(join(runRoot, `${stamp}-${slug(basename(targetRepo))}-`));
};

export const git = (cwd: string, args: string[], options: { allowFail?: boolean } = {}) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0 && !options.allowFail) {
    throw new Error(`git ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
};

export const createWorktree = (
  targetRepo: string,
  worktree: string,
  branch: string,
  ref: string,
): void => {
  mkdirSync(dirname(worktree), { recursive: true });
  git(targetRepo, ["worktree", "add", "-b", branch, worktree, ref]);
};

export const removeWorktree = (targetRepo: string, worktree: string, branch?: string): void => {
  git(targetRepo, ["worktree", "remove", "--force", worktree], { allowFail: true });
  if (branch) {
    git(targetRepo, ["branch", "-D", branch], { allowFail: true });
  }
};

export const diffStats = (worktree: string): CandidateScorecard["diff_stats"] => {
  const result = git(worktree, ["diff", "--numstat"], { allowFail: true });
  let files = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of result.stdout.split(/\r?\n/)) {
    const [ins, del] = line.split(/\s+/);
    if (!ins || !del) continue;
    files += 1;
    insertions += Number.isFinite(Number(ins)) ? Number(ins) : 0;
    deletions += Number.isFinite(Number(del)) ? Number(del) : 0;
  }
  return { files_changed: files, insertions, deletions };
};
