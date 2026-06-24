import { spawn } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type {
  CandidateDiagnostics,
  CandidateStatus,
} from "./plan_bakeoff_report";
import type { Candidate, Manifest } from "./plan_bakeoff_manifest";
import {
  DEFAULT_IDLE_TIMEOUT_MIN,
  DEFAULT_POLL_INTERVAL_SEC,
  DEFAULT_TIMEOUT_GRACE_MIN,
  DEFAULT_WORKER_TIMEOUT_MIN,
} from "./plan_bakeoff_manifest";
import {
  candidateMappedEnv,
  commonSkillRunnerArgs,
  redactText,
  skillRunnerArgsForCandidate,
  type WorkerTiming,
} from "./plan_bakeoff_runtime";
import {
  parseResultStatus,
  statusFromWorker,
  workerDiagnostics,
  workerStatusText,
} from "./plan_bakeoff_worker_result";

const repoRootFromScript = (): string => resolve(dirname(import.meta.path), "..", "..", "..");

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

export const workerTiming = (manifest: Manifest, candidate: Candidate): WorkerTiming => ({
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
  new Promise((resolveResult, reject) => {
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
      resolveResult({ status, stdout, stderr });
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
