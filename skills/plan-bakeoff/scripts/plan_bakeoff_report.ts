import { writeFileSync } from "node:fs";
import { join } from "node:path";

export type CandidateStatus =
  | "SUCCESS"
  | "PARTIAL"
  | "BLOCKED"
  | "FAILED";

export type WorktreeSetupResult = {
  id: string;
  command: string;
  status: "pass" | "fail";
  exit_code: number | null;
  required: boolean;
  output: string;
  artifact?: string;
};

export type CandidateDiagnostics = {
  reason: string;
  output_tail: string;
  artifacts: Array<{ name: string; tail: string }>;
};

export type CandidateScorecard = {
  candidate_id: string;
  status: CandidateStatus;
  worker_status: string;
  base_ref: string;
  worktree: string;
  branch: string;
  run_dir: string;
  setup?: WorktreeSetupResult[];
  verification: Array<{ command: string; status: "pass" | "fail"; output: string }>;
  diff_stats: {
    files_changed: number;
    insertions: number;
    deletions: number;
  };
  route: {
    harness: string;
    provider_profile: string;
    model: string;
  };
  timing: {
    started_at: string;
    finished_at: string;
    elapsed_ms: number;
  };
  diagnostics: CandidateDiagnostics;
};

export const writeScorecard = (scorecard: CandidateScorecard, candidateDir: string): void => {
  writeFileSync(join(candidateDir, "scorecard.json"), JSON.stringify(scorecard, null, 2) + "\n");
  writeFileSync(
    join(candidateDir, "scorecard.md"),
    [
      `# Candidate ${scorecard.candidate_id}`,
      "",
      `- Status: ${scorecard.status}`,
      `- Worker status: ${scorecard.worker_status}`,
      `- Worktree: ${scorecard.worktree}`,
      `- Skill-runner dir: ${scorecard.run_dir || "none"}`,
      `- Elapsed: ${formatDuration(scorecard.timing.elapsed_ms)}`,
      `- Diff: ${scorecard.diff_stats.files_changed} files, +${scorecard.diff_stats.insertions}/-${scorecard.diff_stats.deletions}`,
      ...(shouldShowDiagnostics(scorecard)
        ? [`- Diagnostic reason: ${scorecard.diagnostics.reason || "none"}`]
        : []),
      ...(scorecard.setup?.length
        ? [
            "",
            "## Worktree Setup",
            "",
            ...scorecard.setup.map((item) => `- ${item.status}: \`${item.command}\`${item.artifact ? ` -> ${item.artifact}` : ""}`),
          ]
        : []),
      "",
      "## Verification",
      "",
      ...scorecard.verification.map((item) => `- ${item.status}: \`${item.command}\``),
      ...(shouldShowDiagnostics(scorecard)
        ? [
            "",
            "## Diagnostics",
            "",
            scorecard.diagnostics.output_tail ? "### Runner Output Tail" : "",
            scorecard.diagnostics.output_tail ? fenced(scorecard.diagnostics.output_tail) : "",
            ...scorecard.diagnostics.artifacts.flatMap((artifact) => [
              `### ${artifact.name}`,
              fenced(artifact.tail),
            ]),
          ].filter(Boolean)
        : []),
      "",
    ].join("\n"),
  );
};

const shouldShowDiagnostics = (scorecard: CandidateScorecard): boolean =>
  scorecard.status !== "SUCCESS"
  || scorecard.worker_status === "UNKNOWN"
  || (scorecard.setup ?? []).some((item) => item.status === "fail" && item.required)
  || scorecard.verification.some((item) => item.status === "fail");

const fenced = (text: string): string => ["```text", text, "```"].join("\n");

export const rankScorecards = (scorecards: CandidateScorecard[]): CandidateScorecard[] => {
  const statusScore: Record<CandidateStatus, number> = {
    SUCCESS: 0,
    PARTIAL: 1,
    BLOCKED: 2,
    FAILED: 3,
  };
  return [...scorecards].sort((left, right) => {
    const leftFailures = left.verification.filter((item) => item.status === "fail").length;
    const rightFailures = right.verification.filter((item) => item.status === "fail").length;
    return (
      statusScore[left.status] - statusScore[right.status] ||
      leftFailures - rightFailures ||
      left.diff_stats.files_changed - right.diff_stats.files_changed ||
      left.candidate_id.localeCompare(right.candidate_id)
    );
  });
};

export const writeFinalReport = (runDir: string, scorecards: CandidateScorecard[]): void => {
  const ranked = rankScorecards(scorecards);
  const winner = ranked.find((item) => item.status === "SUCCESS");
  const mergeable = ranked.filter((item) => item.status === "PARTIAL").map((item) => item.candidate_id);
  const rejected = ranked.filter((item) => !["SUCCESS", "PARTIAL"].includes(item.status)).map((item) => item.candidate_id);
  writeFileSync(
    join(runDir, "final-report.md"),
    [
      "# Plan Bakeoff Report",
      "",
      `winner: ${winner?.candidate_id ?? "none"}`,
      `mergeable_with_fixes: ${mergeable.length ? mergeable.join(", ") : "none"}`,
      "cherry_pick_ideas: none",
      `reject: ${rejected.length ? rejected.join(", ") : "none"}`,
      "",
      "## Ranking",
      "",
      ...ranked.map((item, index) => `${index + 1}. ${item.candidate_id} - ${item.status}`),
      "",
      "## Candidate Summary",
      "",
      "| Rank | Candidate | Status | Provider config | Running time | Verification | Diff | Ranking reason | Worktree |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      ...ranked.map((item, index) => candidateSummaryRow(item, index + 1)),
      "",
      "## Verification Summary",
      "",
      ...ranked.map((item) => verificationSummaryLine(item)),
      "",
      "## Candidate Diagnostics",
      "",
      ...ranked.flatMap((item) => candidateDiagnosticLines(item)),
      "",
      "## Recommended Next Action",
      "",
      winner ? `Review ${winner.worktree}, then port with $intuitive-port-worktree if accepted.` : "No clean winner; inspect partial candidates.",
      "",
    ].join("\n"),
  );
};

const candidateSummaryRow = (scorecard: CandidateScorecard, rank: number): string =>
  [
    rank,
    mdCell(scorecard.candidate_id),
    scorecard.status,
    mdCell(providerConfigLabel(scorecard)),
    formatDuration(scorecard.timing.elapsed_ms),
    mdCell(verificationSummaryText(scorecard)),
    mdCell(`${scorecard.diff_stats.files_changed} files, +${scorecard.diff_stats.insertions}/-${scorecard.diff_stats.deletions}`),
    mdCell(rankingReason(scorecard)),
    mdCell(scorecard.worktree),
  ].join(" | ").replace(/^/, "| ").replace(/$/, " |");

const providerConfigLabel = (scorecard: CandidateScorecard): string => {
  const parts = [
    scorecard.route.harness,
    scorecard.route.provider_profile,
    scorecard.route.model,
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "unspecified";
};

const rankingReason = (scorecard: CandidateScorecard): string => {
  const verificationFailures = scorecard.verification.filter((item) => item.status === "fail").length;
  if (scorecard.status === "SUCCESS" && verificationFailures === 0) {
    return `clean success; ${scorecard.diff_stats.files_changed} changed file${scorecard.diff_stats.files_changed === 1 ? "" : "s"}`;
  }
  const setupFailure = (scorecard.setup ?? []).find((item) => item.status === "fail" && item.required);
  if (setupFailure) {
    return `worktree setup failed: ${setupFailure.id}`;
  }
  if (scorecard.diagnostics.reason) {
    return scorecard.diagnostics.reason;
  }
  if (verificationFailures > 0) {
    return `${verificationFailures} verification failure${verificationFailures === 1 ? "" : "s"}`;
  }
  return `status ${scorecard.status.toLowerCase()}`;
};

const verificationSummaryText = (scorecard: CandidateScorecard): string => {
  const pass = scorecard.verification.filter((item) => item.status === "pass").length;
  const fail = scorecard.verification.filter((item) => item.status === "fail").length;
  return `${pass} pass, ${fail} fail`;
};

const mdCell = (value: string): string =>
  value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim() || "none";

const formatDuration = (elapsedMs: number): string => {
  const safeMs = Math.max(0, Math.round(elapsedMs));
  if (safeMs < 1000) {
    return `${safeMs}ms`;
  }
  const totalSeconds = Math.round(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

const verificationSummaryLine = (scorecard: CandidateScorecard): string => {
  return `- ${scorecard.candidate_id}: ${verificationSummaryText(scorecard)}`;
};

const candidateDiagnosticLines = (scorecard: CandidateScorecard): string[] => {
  if (!shouldShowDiagnostics(scorecard)) {
    return [`- ${scorecard.candidate_id}: none`];
  }
  const setupFailure = (scorecard.setup ?? []).find((item) => item.status === "fail" && item.required);
  const setupArtifacts = (scorecard.setup ?? []).flatMap((item) => item.artifact ? [item.artifact] : []);
  const artifactNames = [
    ...setupArtifacts,
    ...scorecard.diagnostics.artifacts.map((artifact) => artifact.name),
  ].join(", ") || "none";
  return [
    `- ${scorecard.candidate_id}: ${scorecard.diagnostics.reason || (setupFailure ? `worktree setup failed: ${setupFailure.id}` : "inspect scorecard diagnostics")} (artifacts: ${artifactNames})`,
  ];
};
