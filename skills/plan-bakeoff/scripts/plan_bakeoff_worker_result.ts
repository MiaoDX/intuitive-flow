import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CandidateDiagnostics,
  CandidateStatus,
} from "./plan_bakeoff_report";
import { redactText } from "./plan_bakeoff_runtime";

export const workerStatusText = (workerDir: string, candidateDir: string): string =>
  [
    ...workerArtifactPaths(workerDir).map(([, path]) => path),
    join(candidateDir, "last-message.md"),
  ]
    .filter((path) => path && existsSync(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

export const parseResultStatus = (text: string): string => {
  const direct = /^\s*RESULT_STATUS:\s*(SUCCESS|PARTIAL|BLOCKED(?:_NEEDS_DECISION)?|FAILED)\b/im.exec(text);
  if (direct) {
    return direct[1].toUpperCase() === "BLOCKED_NEEDS_DECISION" ? "BLOCKED" : direct[1].toUpperCase();
  }
  const match = /-\s*Status:\s*([A-Z_]+)/.exec(text);
  return match?.[1] ?? "UNKNOWN";
};

export const statusFromWorker = (workerStatus: string, exitCode: number): CandidateStatus => {
  if (workerStatus === "SUCCESS") return "SUCCESS";
  if (workerStatus === "PARTIAL") return "PARTIAL";
  if (workerStatus === "BLOCKED" || workerStatus === "BLOCKED_NEEDS_DECISION") return "BLOCKED";
  if (workerStatus === "FAILED") return "FAILED";
  return exitCode === 0 ? "SUCCESS" : "FAILED";
};

export const workerDiagnostics = ({
  workerDir,
  candidateDir,
  workerStatus,
  status,
  exitCode,
  output,
  env,
}: {
  workerDir: string;
  candidateDir: string;
  workerStatus: string;
  status: CandidateStatus;
  exitCode: number;
  output: string;
  env: Record<string, string | undefined>;
}): CandidateDiagnostics => {
  const artifacts = workerArtifactTails(workerDir, candidateDir, env);
  const resultReason = artifactReason(artifacts);
  const reason = resultReason
    || (workerStatus === "UNKNOWN" ? `no parseable worker status; exit code ${exitCode}` : "")
    || (status !== "SUCCESS" ? `worker reported RESULT_STATUS: ${workerStatus}; cli exit code ${exitCode}` : "");
  return {
    reason,
    output_tail: tail(output, 2000),
    artifacts,
  };
};

export const tail = (text: string, limit: number): string =>
  text.length > limit ? text.slice(-limit).trimStart() : text;

const workerArtifactTails = (
  workerDir: string,
  candidateDir: string,
  env: Record<string, string | undefined>,
): CandidateDiagnostics["artifacts"] => {
  const paths = [
    ...workerArtifactPaths(workerDir),
    ["last-message.md", join(candidateDir, "last-message.md")],
  ];
  return paths.flatMap(([name, path]) => {
    if (!path || !existsSync(path)) {
      return [];
    }
    const text = redactText(readFileSync(path, "utf8"), env).trim();
    return text ? [{ name, tail: tail(text, 2000) }] : [];
  });
};

const workerArtifactPaths = (workerDir: string): Array<[string, string]> =>
  workerDir
    ? [
        ["result.md", join(workerDir, "result.md")],
        ["eval.md", join(workerDir, "eval.md")],
        ["stderr.log", join(workerDir, "stderr.log")],
        ["pane-before-stop.log", join(workerDir, "pane-before-stop.log")],
        ["terminal.log", join(workerDir, "terminal.log")],
        ["events.jsonl", join(workerDir, "events.jsonl")],
      ]
    : [];

const artifactReason = (artifacts: CandidateDiagnostics["artifacts"]): string => {
  const result = artifacts.find((artifact) => artifact.name === "result.md")?.tail ?? "";
  const match = /-\s*Reason:\s*(.+)/.exec(result);
  return match?.[1]?.trim() ?? "";
};
