import {
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import type { Candidate, Manifest, WorktreeSetupCommand } from "./plan_bakeoff_manifest";
import type { WorktreeSetupResult } from "./plan_bakeoff_report";
import { redactText } from "./plan_bakeoff_runtime";

export const setupCommandLabel = (command: WorktreeSetupCommand, index: number): string =>
  typeof command === "string"
    ? `setup-${index + 1}`
    : command.id ?? `setup-${index + 1}`;

export const setupCommandText = (command: WorktreeSetupCommand): string =>
  typeof command === "string" ? command : command.command;

const setupCommandRequired = (command: WorktreeSetupCommand): boolean =>
  typeof command === "string" ? true : command.required !== false;

const setupCommandArtifact = (command: WorktreeSetupCommand): string | undefined =>
  typeof command === "string" ? undefined : command.artifact;

const setupCommandArtifactStream = (command: WorktreeSetupCommand): "stdout" | "stderr" | "combined" =>
  typeof command === "string" ? "combined" : command.artifact_stream ?? "combined";

const mergedSetupCommands = (manifest: Manifest, candidate: Candidate): WorktreeSetupCommand[] => [
  ...(manifest.worktree_setup?.commands ?? []),
  ...(candidate.worktree_setup?.commands ?? []),
];

export const runWorktreeSetup = (
  manifest: Manifest,
  candidate: Candidate,
  worktree: string,
  candidateDir: string,
  runDir: string,
  env: Record<string, string | undefined> = process.env,
): WorktreeSetupResult[] => {
  const commands = mergedSetupCommands(manifest, candidate);
  const results: WorktreeSetupResult[] = [];
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    const commandText = setupCommandText(command);
    const result = spawnSync("bash", ["-lc", commandText], {
      cwd: worktree,
      encoding: "utf8",
      env: {
        ...env,
        PLAN_BAKEOFF_CANDIDATE_ID: candidate.id,
        PLAN_BAKEOFF_CANDIDATE_DIR: candidateDir,
        PLAN_BAKEOFF_RUN_DIR: runDir,
        PLAN_BAKEOFF_TARGET_REPO: manifest.target_repo,
        PLAN_BAKEOFF_WORKTREE: worktree,
        ROBOCLAWS_CANDIDATE_ID: candidate.id,
      },
    });
    const combined = `${result.stdout}\n${result.stderr}`;
    const stream = setupCommandArtifactStream(command);
    const artifactText = stream === "stdout" ? result.stdout : stream === "stderr" ? result.stderr : combined;
    const artifact = setupCommandArtifact(command);
    if (artifact) {
      const artifactPath = join(candidateDir, artifact);
      mkdirSync(dirname(artifactPath), { recursive: true });
      writeFileSync(artifactPath, redactText(artifactText, env));
    }
    const setupResult: WorktreeSetupResult = {
      id: setupCommandLabel(command, index),
      command: commandText,
      status: result.status === 0 ? "pass" : "fail",
      exit_code: result.status,
      required: setupCommandRequired(command),
      output: redactText(combined.slice(-4000), env),
      artifact,
    };
    results.push(setupResult);
    if (setupResult.status === "fail" && setupResult.required) {
      break;
    }
  }
  return results;
};
