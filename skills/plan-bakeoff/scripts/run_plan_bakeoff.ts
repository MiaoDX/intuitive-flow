#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { CandidateScorecard } from "./plan_bakeoff_report";
import {
  writeFinalReport,
  writeScorecard,
} from "./plan_bakeoff_report";
import type { Manifest } from "./plan_bakeoff_manifest";
import {
  defaultRunRoot,
  normalizeManifest,
  parseManifestText,
  proposalText,
  proposeCandidates,
  resolvePath,
  slug,
  validateManifest,
} from "./plan_bakeoff_manifest";
import {
  loadDotenv,
  redactText,
} from "./plan_bakeoff_runtime";
import {
  runWorktreeSetup,
  setupCommandLabel,
  setupCommandText,
} from "./plan_bakeoff_worktree_setup";
import {
  createRunDir,
  createWorktree,
  diffStats,
  git,
  removeWorktree,
} from "./plan_bakeoff_worktree";
import { runSkillRunnerCandidate } from "./plan_bakeoff_worker";

type Args = {
  manifest?: string;
  dryRun: boolean;
  execute: boolean;
  propose: boolean;
  runRoot?: string;
  keepWorktrees: boolean;
  envFile?: string;
  executeReal: boolean;
};

const usage = () => `usage: run_plan_bakeoff.ts --manifest <path> [--propose|--dry-run|--execute] [--run-root <dir>] [--env-file <path>] [--keep-worktrees] [--execute-real]
`;

const repoRootFromScript = (): string => resolve(dirname(import.meta.path), "..", "..", "..");

export const runVerification = (worktree: string, commands: string[], env: Record<string, string | undefined> = process.env) =>
  commands.map((command) => {
    const result = spawnSync("bash", ["-lc", command], {
      cwd: worktree,
      encoding: "utf8",
      env: { ...env },
    });
    return {
      command,
      status: result.status === 0 ? "pass" as const : "fail" as const,
      output: redactText(`${result.stdout}\n${result.stderr}`.slice(-4000), env),
    };
  });

export const executeBakeoff = async (
  manifest: Manifest,
  options: {
    dryRun?: boolean;
    keepWorktrees?: boolean;
    env?: Record<string, string | undefined>;
    allowReal?: boolean;
  } = {},
): Promise<string> => {
  const env = options.env ?? process.env;
  const runDir = createRunDir(manifest.run_root ?? defaultRunRoot(manifest.target_repo), manifest.target_repo);
  writeFileSync(join(runDir, "manifest.json"), JSON.stringify(sanitizeManifest(manifest), null, 2) + "\n");
  const baseRef = git(manifest.target_repo, ["rev-parse", manifest.base?.ref ?? "HEAD"]).stdout.trim();

  if (options.dryRun) {
    writeFileSync(join(runDir, "dry-run.md"), dryRunText(manifest, baseRef));
    return runDir;
  }

  const candidateRuns = manifest.candidates.map((candidate) => {
    if (candidate.harness !== "fake" && !options.allowReal) {
      throw new Error(`candidate ${candidate.id}: real harness requires --execute-real`);
    }
    const candidateDir = join(runDir, "candidates", candidate.id);
    const branch = `plan-bakeoff/${slug(basename(runDir))}/${candidate.id}`;
    const worktree = join(runDir, "worktrees", candidate.id);
    createWorktree(manifest.target_repo, worktree, branch, baseRef);
    return { candidate, candidateDir, branch, worktree };
  });

  const runCandidate = async ({ candidate, candidateDir, branch, worktree }: typeof candidateRuns[number]) => {
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    let keepWorktreeAfterRun = options.keepWorktrees ?? false;
    try {
      mkdirSync(candidateDir, { recursive: true });
      const setup = runWorktreeSetup(manifest, candidate, worktree, candidateDir, runDir, env);
      const setupFailure = setup.find((item) => item.status === "fail" && item.required);
      if (setupFailure) {
        keepWorktreeAfterRun = true;
        const finishedAtMs = Date.now();
        const scorecard: CandidateScorecard = {
          candidate_id: candidate.id,
          status: "BLOCKED",
          worker_status: "BLOCKED",
          base_ref: baseRef,
          worktree,
          branch,
          run_dir: "",
          setup,
          verification: [],
          diff_stats: diffStats(worktree),
          route: {
            harness: candidate.harness,
            provider_profile: candidate.provider_profile ?? "",
            model: candidate.model ?? "",
          },
          timing: {
            started_at: startedAt,
            finished_at: new Date(finishedAtMs).toISOString(),
            elapsed_ms: finishedAtMs - startedAtMs,
          },
          diagnostics: {
            reason: `worktree setup failed before worker launch: ${setupFailure.id}`,
            output_tail: setupFailure.output,
            artifacts: [],
          },
        };
        writeScorecard(scorecard, candidateDir);
        return scorecard;
      }
      const worker = await runSkillRunnerCandidate(manifest, candidate, runDir, worktree, env, { allowReal: options.allowReal });
      const verification = runVerification(worktree, manifest.verification?.commands ?? [], env);
      const verificationFailures = verification.filter((item) => item.status === "fail").length;
      const status = verificationFailures > 0 && worker.status === "SUCCESS" ? "PARTIAL" : worker.status;
      const finishedAtMs = Date.now();
      const scorecard: CandidateScorecard = {
        candidate_id: candidate.id,
        status,
        worker_status: worker.workerStatus,
        base_ref: baseRef,
        worktree,
        branch,
        run_dir: worker.runDir,
        setup,
        verification,
        diff_stats: diffStats(worktree),
        route: {
          harness: candidate.harness,
          provider_profile: candidate.provider_profile ?? "",
          model: candidate.model ?? "",
        },
        timing: {
          started_at: startedAt,
          finished_at: new Date(finishedAtMs).toISOString(),
          elapsed_ms: finishedAtMs - startedAtMs,
        },
        diagnostics: verificationFailures > 0 && worker.status === "SUCCESS"
          ? {
              ...worker.diagnostics,
              reason: `worker reported SUCCESS but ${verificationFailures} post-run verification command${verificationFailures === 1 ? "" : "s"} failed`,
            }
          : worker.diagnostics,
      };
      writeScorecard(scorecard, candidateDir);
      return scorecard;
    } finally {
      if (!keepWorktreeAfterRun) {
        removeWorktree(manifest.target_repo, worktree, branch);
      }
    }
  };
  const scorecardsPromise = manifest.execution?.parallel === false
    ? candidateRuns.reduce<Promise<CandidateScorecard[]>>(
        (previous, candidateRun) =>
          previous.then(async (scorecards) => [...scorecards, await runCandidate(candidateRun)]),
        Promise.resolve([]),
      )
    : Promise.all(candidateRuns.map(runCandidate));
  const scorecards = await scorecardsPromise;
  writeFinalReport(runDir, scorecards);
  return runDir;
};

const dryRunText = (manifest: Manifest, baseRef: string): string =>
  [
    "# Plan Bakeoff Dry Run",
    "",
    `Target repo: ${manifest.target_repo}`,
    `Plan: ${manifest.plan}`,
    `Base ref: ${baseRef}`,
    "",
    "## Candidates",
    "",
      ...manifest.candidates.map((candidate) => `- ${candidate.id}: ${candidate.harness} ${candidate.provider_profile ?? ""} ${candidate.model ?? ""}`.trim()),
      "",
    "## Worktree Setup",
    "",
    ...(manifest.worktree_setup?.commands?.length
      ? manifest.worktree_setup.commands.map((command, index) => `- ${setupCommandLabel(command, index)}: ${setupCommandText(command)}`)
      : ["- none"]),
    "",
    ].join("\n");

export const sanitizeManifest = (manifest: Manifest): Manifest => JSON.parse(redactText(JSON.stringify(manifest)));

const parseArgs = (argv: string[]): Args => {
  const args: Args = { dryRun: false, execute: false, propose: false, keepWorktrees: false, executeReal: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") args.manifest = argv[++index];
    else if (arg === "--propose") args.propose = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--execute") args.execute = true;
    else if (arg === "--run-root") args.runRoot = argv[++index];
    else if (arg === "--env-file") args.envFile = argv[++index];
    else if (arg === "--keep-worktrees") args.keepWorktrees = true;
    else if (arg === "--execute-real") args.executeReal = true;
    else if (arg === "-h" || arg === "--help") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!args.manifest) {
    throw new Error("missing --manifest");
  }
  if (!args.propose && !args.dryRun && !args.execute) {
    args.propose = true;
  }
  return args;
};

const main = async () => {
  const args = parseArgs(Bun.argv.slice(2));
  const manifestPath = resolve(args.manifest ?? "");
  const manifest = normalizeManifest(parseManifestText(readFileSync(manifestPath, "utf8")), manifestPath, args.runRoot);
  loadDotenv(args.envFile ? resolve(args.envFile) : join(repoRootFromScript(), ".plan-bakeoff.env"));
  for (const candidate of manifest.candidates) {
    if (candidate.env_file) {
      loadDotenv(resolvePath(candidate.env_file, manifest.target_repo));
    }
  }
  if (args.propose) {
    console.log(proposalText(manifest, proposeCandidates()));
    return;
  }
  const isDryRunOnly = args.dryRun && !args.execute;
  const errors = validateManifest(manifest, process.env, { allowReal: args.executeReal || isDryRunOnly });
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  const runDir = await executeBakeoff(manifest, {
    dryRun: isDryRunOnly,
    keepWorktrees: args.keepWorktrees,
    allowReal: args.executeReal,
  });
  console.log(relative(process.cwd(), runDir).startsWith("..") ? runDir : relative(process.cwd(), runDir));
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
