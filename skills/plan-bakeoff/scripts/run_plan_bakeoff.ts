#!/usr/bin/env bun

import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type {
  CandidateDiagnostics,
  CandidateScorecard,
  CandidateStatus,
} from "./plan_bakeoff_report";
import {
  writeFinalReport,
  writeScorecard,
} from "./plan_bakeoff_report";
import type { Candidate, Manifest } from "./plan_bakeoff_manifest";
import {
  DEFAULT_IDLE_TIMEOUT_MIN,
  DEFAULT_POLL_INTERVAL_SEC,
  DEFAULT_TIMEOUT_GRACE_MIN,
  DEFAULT_WORKER_TIMEOUT_MIN,
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
  candidateMappedEnv,
  commonSkillRunnerArgs,
  loadDotenv,
  redactText,
  skillRunnerArgsForCandidate,
} from "./plan_bakeoff_runtime";
import type { WorkerTiming } from "./plan_bakeoff_runtime";
import {
  runWorktreeSetup,
  setupCommandLabel,
  setupCommandText,
} from "./plan_bakeoff_worktree_setup";
import {
  parseResultStatus,
  statusFromWorker,
  workerDiagnostics,
  workerStatusText,
} from "./plan_bakeoff_worker_result";

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

const shellQuote = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

const fakeAgentScript = (candidate: Candidate, dir: string, runDir: string, candidateCount: number): string => {
  const script = join(dir, "fake-agent.sh");
  const status = candidate.command_profile === "fake-partial" ? "PARTIAL" : candidate.command_profile === "fake-failed" ? "FAILED" : "SUCCESS";
  const summary = `${candidate.id} ${status.toLowerCase()}`;
  const barrierBlock = candidate.command_profile === "fake-barrier-success"
    ? [
        `barrier_dir=${shellQuote(join(runDir, "fake-barrier"))}`,
        "mkdir -p \"$barrier_dir\"",
        `touch "$barrier_dir"/${shellQuote(candidate.id)}.started`,
        "deadline=$((SECONDS + 20))",
        `while [ "$(find "$barrier_dir" -name '*.started' | wc -l)" -lt ${candidateCount} ]; do`,
        "  if [ \"$SECONDS\" -ge \"$deadline\" ]; then",
        `    printf '%s\\n' 'RESULT_STATUS: FAILED' 'SUMMARY: ${candidate.id} timed out waiting for parallel peers' 'CHANGED_FILES: none' 'COMMITS: none' 'VERIFICATION: fake-worker' 'OPEN_DECISIONS: none' 'SKILL_BEHAVIOR_NOTES: parallel launch barrier was not satisfied' 'ACCEPTANCE_EVIDENCE: incomplete' 'RECOMMENDED_GOAL_REVISION: none'`,
        "    exit 1",
        "  fi",
        "  sleep 0.1",
        "done",
      ]
    : [];
  writeFileSync(
    script,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "cat >/dev/null",
      ...barrierBlock,
      `printf '%s\\n' 'RESULT_STATUS: ${status}' 'SUMMARY: ${summary}' 'CHANGED_FILES: none' 'COMMITS: none' 'VERIFICATION: fake-worker' 'OPEN_DECISIONS: none' 'SKILL_BEHAVIOR_NOTES: none' 'ACCEPTANCE_EVIDENCE: fake candidate completed' 'RECOMMENDED_GOAL_REVISION: none'`,
      "",
    ].join("\n"),
  );
  chmodSync(script, 0o755);
  return script;
};

export const runSkillRunnerCandidate = (
  manifest: Manifest,
  candidate: Candidate,
  runDir: string,
  worktree: string,
  env: Record<string, string | undefined> = process.env,
  options: { allowReal?: boolean } = {},
): Promise<{ runDir: string; status: CandidateStatus; workerStatus: string; output: string; diagnostics: CandidateDiagnostics }> => {
  const candidateDir = join(runDir, "candidates", candidate.id);
  mkdirSync(candidateDir, { recursive: true });
  const home = join(candidateDir, "home");
  mkdirSync(home, { recursive: true });
  const codexHome = join(home, ".codex");
  mkdirSync(codexHome, { recursive: true });
  if (candidate.harness !== "fake" && !options.allowReal) {
    throw new Error(`candidate ${candidate.id}: real harness requires --execute-real`);
  }
  const skillRunnerScript = join(repoRootFromScript(), "skills", "skill-runner", "scripts", "run_skill_runner.py");
  const workerRunRoot = join(candidateDir, "skill-runner-runs");
  const prompt = bakeoffPrompt(manifest, candidate);
  const timing = workerTiming(manifest, candidate);
  const skillRunnerArgs = candidate.harness === "fake"
    ? [
        ...commonSkillRunnerArgs(candidate, worktree, workerRunRoot, timing),
        "--agent-command",
        fakeAgentScript(
          candidate,
          candidateDir,
          runDir,
          manifest.candidates.filter((item) => item.command_profile === "fake-barrier-success").length,
        ),
      ]
    : skillRunnerArgsForCandidate(candidate, worktree, workerRunRoot, timing, env);
  return runProcess(
    "python3",
    [
      skillRunnerScript,
      ...skillRunnerArgs,
      "--",
      prompt,
    ],
    {
      cwd: repoRootFromScript(),
      env: {
        ...env,
        ...candidateMappedEnv(candidate, env),
        HOME: home,
        CODEX_HOME: codexHome,
        PLAN_BAKEOFF_CANDIDATE_ID: candidate.id,
        PLAN_BAKEOFF_CANDIDATE_DIR: candidateDir,
        PLAN_BAKEOFF_RUN_DIR: runDir,
        PLAN_BAKEOFF_TARGET_REPO: manifest.target_repo,
        PLAN_BAKEOFF_WORKTREE: worktree,
      },
    },
  ).then((result) => {
    const output = redactText(`${result.stdout}\n${result.stderr}`, env);
    const workerDir = result.stdout.trim().split("\n").at(-1)?.trim() ?? "";
    const resultText = workerStatusText(workerDir, candidateDir);
    const workerStatus = parseResultStatus(resultText);
    const status = statusFromWorker(workerStatus, result.status ?? 1);
    return {
      runDir: workerDir,
      status,
      workerStatus,
      output,
      diagnostics: workerDiagnostics({
        workerDir,
        candidateDir,
        workerStatus,
        status,
        exitCode: result.status ?? 1,
        output,
        env,
      }),
    };
  });
};

const workerTiming = (manifest: Manifest, candidate: Candidate): WorkerTiming => ({
  timeoutMin: candidate.timeout_min ?? manifest.execution?.worker_timeout_min ?? DEFAULT_WORKER_TIMEOUT_MIN,
  idleTimeoutMin: candidate.idle_timeout_min ?? manifest.execution?.idle_timeout_min ?? DEFAULT_IDLE_TIMEOUT_MIN,
  timeoutGraceMin: candidate.timeout_grace_min ?? manifest.execution?.timeout_grace_min ?? DEFAULT_TIMEOUT_GRACE_MIN,
  pollIntervalSec: manifest.execution?.poll_interval_sec ?? DEFAULT_POLL_INTERVAL_SEC,
});

const runProcess = (
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string | undefined> },
): Promise<{ status: number | null; stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: Object.fromEntries(
        Object.entries(options.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
      ),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });

export const bakeoffPrompt = (manifest: Manifest, candidate: Candidate): string =>
  manifest.worker_goal
    ? [
        manifest.worker_goal.trim(),
        "",
        `Plan-bakeoff candidate: ${candidate.id}.`,
        "Use $intuitive-flow to execute the goal in this isolated worktree.",
        "Continue until the plan acceptance criteria and verification gates pass, or until you can name a concrete blocker.",
        "The approved plan is embedded below; prefer the worktree path when it exists.",
        "",
        "```markdown",
        readFileSync(manifest.plan, "utf8").trim(),
        "```",
        "",
        "Do not launch a separate coding agent; this candidate worker owns implementation in this isolated worktree.",
        "End with RESULT_STATUS: SUCCESS, PARTIAL, BLOCKED, or FAILED plus concise acceptance evidence.",
      ].join("\n")
    : [
        `Implement approved plan ${manifest.plan} directly in this worktree.`,
        `Plan-bakeoff candidate: ${candidate.id}.`,
        "The approved plan is embedded below; do not read the plan path unless it exists in this worktree.",
        "",
        "```markdown",
        readFileSync(manifest.plan, "utf8").trim(),
        "```",
        "",
        "Use the accepted plan as scope. Do not delegate to skill-runner, tmux, or another coding agent.",
        "End with RESULT_STATUS: SUCCESS, PARTIAL, BLOCKED, or FAILED plus concise acceptance evidence.",
      ].join("\n");

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
