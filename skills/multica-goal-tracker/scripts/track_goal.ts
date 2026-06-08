#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

type Issue = {
  identifier?: string;
  id?: string;
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  updated_at?: string;
};

type JsonRecord = Record<string, unknown>;

type RenderedEvidence = {
  dir: string;
  attachment: string;
  htmlPath: string;
  svgPath: string;
};

export type GoalSummary = {
  purpose: string;
  route: string;
  sources: string[];
  proof: string;
  rawGoal: string;
};

export type SessionEvidence = {
  source: string;
  outcome: string;
  proofNote: string;
  excerpt: string;
  messageCount: number;
};

type Options = {
  command: string;
  issue?: string;
  runId?: string;
  goal?: string;
  goalFile?: string;
  sessionText?: string;
  sessionFile?: string;
  sessionDir?: string;
  summary?: string;
  summaryFile?: string;
  proof?: string;
  allowManualSummary: boolean;
  updateDescription: boolean;
  dryRun: boolean;
  profile?: string;
  workspaceId?: string;
};

const skillDir = dirname(dirname(new URL(import.meta.url).pathname));

function usage(): never {
  console.error(`Usage:
  track_goal.ts start --issue MIA-40 [--goal-file goal.txt] [--update-description] [--dry-run]
  track_goal.ts finish --issue MIA-40 [--run-id <task-id>] [--session-file transcript.txt] [--session-dir <skill-runner-dir>] [--dry-run]
  track_goal.ts summarize --goal-file goal.txt

Options:
  --goal <text>             Inline goal text.
  --goal-file <path|- >     Read goal text from file or stdin.
  --run-id <task-id>        Use a specific Multica execution run.
  --session-text <text>     Inline real session transcript/output.
  --session-file <path|- >  Read real session transcript/output from file or stdin. Codex JSONL is reduced to real assistant output.
  --session-dir <path>      Read real skill-runner artifacts: result.md, eval.md, last-message.md, rewritten-prompt.md.
  --summary <text>          Manual finish summary, only with --allow-manual-summary.
  --summary-file <path|- >  Read manual finish summary, only with --allow-manual-summary.
  --proof <text>            Short verification/proof note for finish.
  --allow-manual-summary    Permit manual summary fallback when no session history exists.
  --update-description      Insert/replace the tracker summary block in the issue description.
  --profile <name>          Forward a Multica profile.
  --workspace-id <id>       Forward a Multica workspace id or slug.
  --dry-run                 Print and render locally without writing to Multica.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const command = argv.shift();
  if (!command || !["start", "finish", "summarize"].includes(command)) usage();

  const opts: Options = { command, allowManualSummary: false, updateDescription: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) usage();
      return value;
    };
    switch (arg) {
      case "--issue":
        opts.issue = next();
        break;
      case "--run-id":
        opts.runId = next();
        break;
      case "--goal":
        opts.goal = next();
        break;
      case "--goal-file":
        opts.goalFile = next();
        break;
      case "--session-text":
        opts.sessionText = next();
        break;
      case "--session-file":
        opts.sessionFile = next();
        break;
      case "--session-dir":
        opts.sessionDir = next();
        break;
      case "--summary":
        opts.summary = next();
        break;
      case "--summary-file":
        opts.summaryFile = next();
        break;
      case "--proof":
        opts.proof = next();
        break;
      case "--allow-manual-summary":
        opts.allowManualSummary = true;
        break;
      case "--update-description":
        opts.updateDescription = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--profile":
        opts.profile = next();
        break;
      case "--workspace-id":
        opts.workspaceId = next();
        break;
      case "-h":
      case "--help":
        usage();
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        usage();
    }
  }

  if (opts.command !== "summarize" && !opts.issue) {
    console.error("--issue is required");
    usage();
  }
  return opts;
}

function readInput(inline?: string, file?: string): string {
  if (inline !== undefined) return inline;
  if (!file) return "";
  if (file === "-") return readFileSync(0, "utf8");
  return readFileSync(file, "utf8");
}

function runMultica(opts: Options, args: string[], input?: string): string {
  const globalArgs: string[] = [];
  if (opts.profile) globalArgs.push("--profile", opts.profile);
  if (opts.workspaceId) globalArgs.push("--workspace-id", opts.workspaceId);

  const result = spawnSync("multica", [...globalArgs, ...args], {
    input,
    encoding: "utf8",
    env: { ...process.env, PATH: `${homedir()}/.local/bin:${process.env.PATH ?? ""}` },
  });
  if (result.error) {
    throw new Error(`failed to run multica: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`multica ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function getIssue(opts: Options): Issue {
  const out = runMultica(opts, ["issue", "get", opts.issue!, "--output", "json"]);
  return JSON.parse(out) as Issue;
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : undefined;
}

export function nestedArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  for (const key of keys) {
    const child = record[key];
    if (Array.isArray(child)) return child;
  }
  return [];
}

export function textFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(textFromUnknown).filter(Boolean).join("\n");
  }
  const record = asRecord(value);
  if (!record) return "";
  for (const key of ["text", "content", "message", "summary", "output", "result"]) {
    const text = textFromUnknown(record[key]);
    if (text) return text;
  }
  return JSON.stringify(value);
}

export function runIdFromRun(run: unknown): string {
  const record = asRecord(run);
  if (!record) return "";
  for (const key of ["id", "task_id", "taskId", "run_id", "runId"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function timestampFromRecord(value: unknown): number | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  for (const key of ["updated_at", "updatedAt", "created_at", "createdAt", "started_at", "startedAt", "completed_at", "completedAt"]) {
    const value = record[key];
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }
  return undefined;
}

export function selectLatestRunId(runs: unknown[]): string | undefined {
  let selected: { id: string; timestamp?: number; index: number } | undefined;
  for (const [index, run] of runs.entries()) {
    const id = runIdFromRun(run);
    if (!id) {
      continue;
    }
    const timestamp = timestampFromRecord(run);
    if (!selected) {
      selected = { id, timestamp, index };
      continue;
    }
    if (timestamp !== undefined && (selected.timestamp === undefined || timestamp > selected.timestamp)) {
      selected = { id, timestamp, index };
      continue;
    }
    if (timestamp === undefined && selected.timestamp === undefined && index > selected.index) {
      selected = { id, index };
    }
  }
  return selected?.id;
}

function getIssueRuns(opts: Options): unknown[] {
  const out = runMultica(opts, ["issue", "runs", opts.issue!, "--output", "json"]);
  return nestedArray(JSON.parse(out) as unknown, ["runs", "tasks", "executions"]);
}

function getLatestRunId(opts: Options): string | undefined {
  if (opts.runId) return opts.runId;
  return selectLatestRunId(getIssueRuns(opts));
}

function getRunMessages(opts: Options, runId: string): unknown[] {
  const out = runMultica(opts, ["issue", "run-messages", runId, "--issue", opts.issue!, "--output", "json"]);
  return nestedArray(JSON.parse(out) as unknown, ["messages", "items", "events"]);
}

export function normalizeTranscript(text: string): string {
  return text
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .join("\n")
    .trim();
}

export function pickOutcomeFromTranscript(transcript: string): string {
  const lines = transcript.split("\n").map((line) => line.trim()).filter(Boolean);
  const resultIndex = [...lines].reverse().findIndex((line) => /RESULT_STATUS|SUCCESS|PARTIAL|BLOCKED|FAILED/i.test(line));
  if (resultIndex >= 0) {
    const realIndex = lines.length - 1 - resultIndex;
    return truncate(lines.slice(Math.max(0, realIndex - 2), realIndex + 3).join(" "), 260);
  }
  return truncate(lines.slice(-5).join(" "), 260);
}

export function sessionEvidenceFromTranscript(source: string, transcript: string, proofOverride?: string): SessionEvidence {
  const normalized = normalizeTranscript(transcript);
  if (!normalized) throw new Error(`Session evidence source '${source}' was empty.`);
  return {
    source,
    outcome: pickOutcomeFromTranscript(normalized),
    proofNote: proofOverride || "Derived from real session transcript/output.",
    excerpt: truncate(normalized.slice(Math.max(0, normalized.length - 1800)), 900),
    messageCount: normalized.split("\n").length,
  };
}

function maybeParseJsonLine(line: string): JsonRecord | undefined {
  try {
    return asRecord(JSON.parse(line) as unknown);
  } catch {
    return undefined;
  }
}

function codexMessageText(value: unknown): string {
  const record = asRecord(value);
  if (!record) return "";
  const content = record.content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        const itemRecord = asRecord(item);
        if (!itemRecord) return "";
        if (itemRecord.type === "output_text" || itemRecord.type === "text") {
          return textFromUnknown(itemRecord.text);
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return textFromUnknown(content);
}

export function transcriptFromCodexJsonl(raw: string): string | undefined {
  const assistantMessages: string[] = [];
  const taskMessages: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const parsed = maybeParseJsonLine(line.trim());
    if (!parsed) continue;

    const type = parsed.type;
    const payload = asRecord(parsed.payload);
    if (!payload) continue;

    if (type === "response_item") {
      if (payload.type !== "message" || payload.role !== "assistant") continue;
      const text = codexMessageText(payload).trim();
      if (text) assistantMessages.push(text);
      continue;
    }

    if (type === "event_msg") {
      if (payload.type === "agent_message") {
        const message = textFromUnknown(payload.message).trim();
        if (message) assistantMessages.push(message);
      }
      if (payload.type === "task_complete") {
        const message = textFromUnknown(payload.last_agent_message).trim();
        if (message) taskMessages.push(message);
      }
    }
  }

  const candidates = [...assistantMessages, ...taskMessages].filter(Boolean);
  if (candidates.length === 0) return undefined;
  const final =
    [...candidates]
      .reverse()
      .find((message) => /RESULT_STATUS|^SUMMARY:|CHANGED_FILES:|VERIFICATION:/im.test(message)) ?? candidates[candidates.length - 1];
  return final.trim();
}

function looksLikeCodexJsonl(text: string): boolean {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 20);
  if (lines.length === 0) return false;
  return lines.some((line) => {
    const parsed = maybeParseJsonLine(line);
    if (!parsed) return false;
    const payload = asRecord(parsed.payload);
    return typeof parsed.type === "string" && Boolean(payload);
  });
}

export function sessionEvidenceFromSessionText(source: string, text: string, proofOverride?: string): SessionEvidence {
  if (looksLikeCodexJsonl(text)) {
    const transcript = transcriptFromCodexJsonl(text);
    if (transcript) {
      return sessionEvidenceFromTranscript(`codex session ${source}`, transcript, proofOverride || "Extracted from real Codex session assistant output.");
    }
  }
  return sessionEvidenceFromTranscript(source, text, proofOverride);
}

function readableFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

export function transcriptFromSkillRunnerDir(dir: string): string {
  const files = ["result.md", "eval.md", "last-message.md", "rewritten-prompt.md"];
  const parts = files
    .map((name) => {
      const path = join(dir, name);
      if (!readableFile(path)) return "";
      return `# ${name}\n\n${readFileSync(path, "utf8").trim()}`;
    })
    .filter((part) => part.trim());

  if (parts.length === 0) {
    throw new Error(`No readable skill-runner evidence files found in ${dir}. Expected one of: ${files.join(", ")}`);
  }
  return parts.join("\n\n");
}

export function sessionEvidenceFromSkillRunnerDir(dir: string, proofOverride?: string): SessionEvidence {
  const transcript = transcriptFromSkillRunnerDir(dir);
  return sessionEvidenceFromTranscript(`skill-runner dir ${dir}`, transcript, proofOverride || "Extracted from real skill-runner result/eval artifacts.");
}

function sessionEvidenceFromRun(opts: Options, runId: string, proofOverride?: string): SessionEvidence {
  const messages = getRunMessages(opts, runId);
  const text = messages
    .map((message) => {
      const record = asRecord(message);
      const seq = record ? textFromUnknown(record.sequence ?? record.seq ?? record.index) : "";
      const role = record ? textFromUnknown(record.role ?? record.type ?? record.kind) : "";
      const body = textFromUnknown(message);
      return [seq && `#${seq}`, role && `[${role}]`, body].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join("\n");
  const evidence = sessionEvidenceFromTranscript(`multica run ${runId}`, text, proofOverride);
  return { ...evidence, messageCount: messages.length };
}

function loadSessionEvidence(opts: Options): SessionEvidence {
  if (opts.sessionDir) {
    return sessionEvidenceFromSkillRunnerDir(opts.sessionDir, opts.proof);
  }

  const sessionText = readInput(opts.sessionText, opts.sessionFile);
  if (sessionText.trim()) {
    return sessionEvidenceFromSessionText(opts.sessionFile ? `file ${opts.sessionFile}` : "inline session text", sessionText, opts.proof);
  }

  const runId = getLatestRunId(opts);
  if (runId) {
    return sessionEvidenceFromRun(opts, runId, opts.proof);
  }

  if (opts.allowManualSummary) {
    const manual = readInput(opts.summary, opts.summaryFile).trim();
    if (!manual) {
      throw new Error("--allow-manual-summary requires --summary or --summary-file when no session history exists.");
    }
    return {
      source: "manual summary fallback",
      outcome: manual,
      proofNote: opts.proof || "Manual summary fallback explicitly allowed.",
      excerpt: manual,
      messageCount: 0,
    };
  }

  throw new Error(
    "No Multica execution run history found for this issue. Pass --session-file with the real session transcript/output, --session-dir for a real skill-runner run directory, --run-id for a specific run, or --allow-manual-summary to use a manual summary fallback.",
  );
}

function getIssueComments(opts: Options): unknown[] {
  const out = runMultica(opts, ["issue", "comment", "list", opts.issue!, "--output", "json"]);
  return nestedArray(JSON.parse(out) as unknown, ["comments", "items", "threads", "data"]);
}

function stripCodeFenceNoise(text: string): string {
  return text
    .replace(/```[a-zA-Z0-9_-]*\n/g, "")
    .replace(/```/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function extractGoal(text: string): string {
  if (!text) return "";
  const fenceMatches = [...text.matchAll(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const goalFence = fenceMatches.find((block) => /\/goal\b/.test(block));
  if (goalFence) return goalFence.trim();

  const cleaned = stripCodeFenceNoise(text);
  const idx = cleaned.search(/\/goal\b/);
  if (idx < 0) return "";
  return cleaned.slice(idx).trim();
}

export function extractTrackedGoalFromComments(comments: unknown[]): string {
  let selected: { goal: string; timestamp?: number; index: number } | undefined;
  for (const [index, comment] of comments.entries()) {
    const text = textFromUnknown(comment);
    if (!text.includes("multica-goal-tracker:start")) {
      continue;
    }
    const goal = extractGoal(text);
    if (goal) {
      const timestamp = timestampFromRecord(comment);
      if (!selected) {
        selected = { goal, timestamp, index };
        continue;
      }
      if (timestamp !== undefined && (selected.timestamp === undefined || timestamp > selected.timestamp)) {
        selected = { goal, timestamp, index };
        continue;
      }
      if (timestamp === undefined && selected.timestamp === undefined && index > selected.index) {
        selected = { goal, index };
      }
    }
  }
  return selected?.goal ?? "";
}

function resolveGoal(opts: Options, issue: Issue, allowTrackedComments: boolean): string {
  const suppliedGoal = readInput(opts.goal, opts.goalFile);
  if (suppliedGoal.trim()) {
    return suppliedGoal;
  }

  const descriptionGoal = extractGoal(issue.description ?? "");
  if (descriptionGoal) {
    return descriptionGoal;
  }

  if (!allowTrackedComments) {
    return "";
  }

  return extractTrackedGoalFromComments(getIssueComments(opts));
}

export function normalizeLines(goal: string): string[] {
  return stripCodeFenceNoise(goal)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^\/goal\b\s*/i, "").trim())
    .filter(Boolean)
    .filter((line) => !/^\$skill-runner\b/.test(line));
}

export function sentenceCaseAction(line: string): string {
  return line
    .replace(/^impl\b/i, "Implement")
    .replace(/^execute\b/i, "Execute")
    .replace(/^fix\b/i, "Fix")
    .replace(/^refactor\b/i, "Refactor")
    .replace(/^run\b/i, "Run")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeGoal(goal: string): GoalSummary {
  const lines = normalizeLines(goal);
  const rawGoal = stripCodeFenceNoise(goal);
  if (!rawGoal) throw new Error("No goal text found. Pass --goal or --goal-file.");

  const routeTokens = [...new Set([...rawGoal.matchAll(/\$[a-z][a-z0-9-]*/g)].map((m) => m[0]))];
  const route = routeTokens.length ? routeTokens.join(", ") : "manual goal";
  const sources = [...new Set([...rawGoal.matchAll(/(?:^|\s)((?:\.?\/)?(?:docs|\.planning|tasks|specs|tests|src|scripts|packages|server|web)\/[^\s`'")]+)/g)].map((m) => m[1]))];

  const proofLines = lines.filter((line) =>
    /\b(test|verify|verification|visual harness|harness|screenshot|proof|check|make sure|regression|reasonable|works)\b/i.test(line),
  );
  const actionLine =
    lines.find((line) => /\b(impl|implement|execute|fix|refactor|remove|add|create|build|run|audit|migrate|cleanup|clean up)\b/i.test(line)) ??
    lines[0] ??
    "Complete the requested goal";

  const purpose = sentenceCaseAction(actionLine.replace(/\s+via\s+\$[a-z0-9-]+/gi, ""));
  const proof = proofLines.length ? proofLines.map(sentenceCaseAction).join(" ") : "Use the goal's stated verification or definition of done.";

  return { purpose, route, sources, proof, rawGoal };
}

export function markdownForStart(summary: GoalSummary): string {
  const sources = summary.sources.length ? summary.sources.map((s) => `\`${s}\``).join(", ") : "Not explicit in goal.";
  return `<!-- multica-goal-tracker:start -->
## Tracked goal start

**Purpose:** ${summary.purpose}

**Route:** ${summary.route}

**Source artifacts:** ${sources}

**Expected proof:** ${summary.proof}

**Goal command:**

\`\`\`text
${summary.rawGoal}
\`\`\`
`;
}

export function summaryBlock(summary: GoalSummary): string {
  const sources = summary.sources.length ? summary.sources.map((s) => `\`${s}\``).join(", ") : "Not explicit in goal.";
  return `<!-- multica-goal-tracker:summary:start -->
## Goal Summary

**Purpose:** ${summary.purpose}

**Route:** ${summary.route}

**Source artifacts:** ${sources}

**Expected proof:** ${summary.proof}
<!-- multica-goal-tracker:summary:end -->`;
}

export function replaceMarkedBlock(existing: string, block: string): string {
  const start = "<!-- multica-goal-tracker:summary:start -->";
  const end = "<!-- multica-goal-tracker:summary:end -->";
  const re = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  if (re.test(existing)) return existing.replace(re, block);
  return `${block}\n\n${existing}`.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function artifactDir(issue: Issue): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\./g, "");
  const issueKey = issue.identifier ?? issue.id ?? "issue";
  return join(homedir(), ".cache", "multica-goal-tracker", issueKey, `${stamp}-${process.pid}`);
}

function renderEvidence(issue: Issue, summary: GoalSummary, session: SessionEvidence): RenderedEvidence {
  const dir = artifactDir(issue);
  mkdirSync(dir, { recursive: true });
  const htmlPath = join(dir, "completion-card.html");
  const svgPath = join(dir, "completion-card.svg");
  const pngPath = join(dir, "completion-card.png");
  const timestamp = new Date().toLocaleString("sv-SE", { timeZoneName: "short" });
  const issueKey = issue.identifier ?? issue.id ?? "Issue";
  const title = issue.title ?? "";
  const status = issue.status ?? "unknown";

  const cardInner = `
    <div class="topline">
      <span>${htmlEscape(issueKey)}</span>
      <span>${htmlEscape(status)}</span>
    </div>
    <h1>${htmlEscape(truncate(title, 96))}</h1>
    <section>
      <div class="label">Goal purpose</div>
      <p>${htmlEscape(truncate(summary.purpose, 210))}</p>
    </section>
    <section>
      <div class="label">Outcome</div>
      <p>${htmlEscape(truncate(session.outcome, 240))}</p>
    </section>
    <section class="grid">
      <div>
        <div class="label">Route</div>
        <p>${htmlEscape(summary.route)}</p>
      </div>
      <div>
        <div class="label">Session source</div>
        <p>${htmlEscape(truncate(session.source, 180))}</p>
      </div>
    </section>
    <section>
      <div class="label">Proof note</div>
      <p>${htmlEscape(truncate(session.proofNote, 200))}</p>
    </section>
    <footer>Rendered by multica-goal-tracker at ${htmlEscape(timestamp)} · messages: ${session.messageCount}</footer>
  `;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    width: 1400px;
    height: 900px;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f5f5f2;
    color: #151712;
  }
  .card {
    width: 1240px;
    height: 780px;
    margin: 60px 80px;
    padding: 46px 64px;
    background: #ffffff;
    border: 1px solid #d9dbd2;
    box-shadow: 0 28px 80px rgba(20, 24, 16, 0.16);
  }
  .topline {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #386641;
    font-size: 28px;
    font-weight: 720;
    letter-spacing: 0;
    text-transform: uppercase;
  }
  h1 {
    margin: 26px 0 28px;
    font-size: 50px;
    line-height: 1.06;
    letter-spacing: 0;
    max-width: 1100px;
  }
  section { margin: 18px 0; }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 40px;
  }
  .label {
    color: #606656;
    font-size: 20px;
    font-weight: 720;
    letter-spacing: 0;
    margin-bottom: 8px;
    text-transform: uppercase;
  }
  p {
    margin: 0;
    color: #25291f;
    font-size: 28px;
    line-height: 1.22;
  }
  footer {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid #e1e3dc;
    color: #73786b;
    font-size: 22px;
  }
</style>
</head>
<body><main class="card">${cardInner}</main></body>
</html>
`;
  writeFileSync(htmlPath, html);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900">
  <foreignObject width="1400" height="900">${html.replace(/<!doctype html>\n?/, "")}</foreignObject>
</svg>
`;
  writeFileSync(svgPath, svg);

  const chrome = findCommand(["google-chrome", "chromium", "chromium-browser"]);
  if (chrome) {
    const result = spawnSync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--window-size=1400,900",
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ], { encoding: "utf8" });
    if (result.status === 0 && existsSync(pngPath)) {
      return { dir, attachment: pngPath, htmlPath, svgPath };
    }
  }
  return { dir, attachment: svgPath, htmlPath, svgPath };
}

function findCommand(commands: string[]): string | undefined {
  for (const command of commands) {
    const result = spawnSync("bash", ["-lc", `command -v ${command}`], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  }
  return undefined;
}

export function markdownFenceText(value: string): string {
  return value.replace(/```/g, "\\`\\`\\`");
}

export function markdownForFinish(issue: Issue, summary: GoalSummary, session: SessionEvidence, attachment: string): string {
  return `<!-- multica-goal-tracker:finish -->
## Tracked goal finish

**Issue:** ${issue.identifier ?? issue.id ?? "unknown"}

**Status:** ${issue.status ?? "unknown"}

**Session source:** ${session.source}

**Message count:** ${session.messageCount}

**Outcome:** ${session.outcome}

**Proof note:** ${session.proofNote}

**Evidence:** attached rendered completion card.

**Goal purpose:** ${summary.purpose}

**Session excerpt:**

\`\`\`text
${markdownFenceText(session.excerpt)}
\`\`\`

Local evidence artifact: \`${attachment}\`
`;
}

function writeTempMarkdown(dir: string, name: string, content: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

function printDryRun(kind: string, content: string, extra: Record<string, string> = {}) {
  console.log(`DRY RUN: ${kind}`);
  for (const [key, value] of Object.entries(extra)) {
    console.log(`${key}: ${value}`);
  }
  console.log("--- content ---");
  console.log(content);
}

function start(opts: Options) {
  const issue = getIssue(opts);
  const goal = resolveGoal(opts, issue, false);
  const summary = summarizeGoal(goal);
  const comment = markdownForStart(summary);

  if (opts.dryRun) {
    printDryRun("start comment", comment);
  } else {
    const dir = artifactDir(issue);
    const commentFile = writeTempMarkdown(dir, "start-comment.md", comment);
    runMultica(opts, ["issue", "comment", "add", opts.issue!, "--content-file", commentFile, "--output", "json"]);
    console.log(`Added tracker start comment to ${issue.identifier ?? opts.issue}`);
  }

  if (opts.updateDescription) {
    const updated = replaceMarkedBlock(issue.description ?? "", summaryBlock(summary));
    if (opts.dryRun) {
      printDryRun("description update", updated);
    } else {
      const dir = artifactDir(issue);
      const descFile = writeTempMarkdown(dir, "description.md", updated);
      runMultica(opts, ["issue", "update", opts.issue!, "--description-file", descFile, "--output", "json"]);
      console.log(`Updated description for ${issue.identifier ?? opts.issue}`);
    }
  }
}

function finish(opts: Options) {
  const issue = getIssue(opts);
  const goal = resolveGoal(opts, issue, true);
  const summary = summarizeGoal(goal);
  const session = loadSessionEvidence(opts);
  const evidence = renderEvidence(issue, summary, session);
  const comment = markdownForFinish(issue, summary, session, evidence.attachment);

  if (opts.dryRun) {
    printDryRun("finish comment", comment, {
      attachment: evidence.attachment,
      html: evidence.htmlPath,
      svg: evidence.svgPath,
    });
    return;
  }

  const commentFile = writeTempMarkdown(evidence.dir, "finish-comment.md", comment);
  runMultica(opts, [
    "issue",
    "comment",
    "add",
    opts.issue!,
    "--content-file",
    commentFile,
    "--attachment",
    evidence.attachment,
    "--output",
    "json",
  ]);
  console.log(`Added tracker finish comment to ${issue.identifier ?? opts.issue}`);
  console.log(`Attached evidence: ${evidence.attachment}`);
}

function summarize(opts: Options) {
  const goal = readInput(opts.goal, opts.goalFile);
  const summary = summarizeGoal(goal);
  console.log(JSON.stringify(summary, null, 2));
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  try {
    if (opts.command === "start") start(opts);
    if (opts.command === "finish") finish(opts);
    if (opts.command === "summarize") summarize(opts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: ${message}`);
    console.error(`Skill directory: ${skillDir}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
