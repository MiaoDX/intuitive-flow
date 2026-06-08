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
  rawOutput: string;
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
    proofNote: proofOverride || "来自真实 session transcript/output。",
    excerpt: truncate(normalized.slice(Math.max(0, normalized.length - 1800)), 900),
    rawOutput: normalized,
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
      return sessionEvidenceFromTranscript(`codex session ${source}`, transcript, proofOverride || "从真实 Codex session assistant 输出中提取。");
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
  return sessionEvidenceFromTranscript(`skill-runner dir ${dir}`, transcript, proofOverride || "从真实 skill-runner result/eval artifacts 中提取。");
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
      rawOutput: manual,
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
    .replace(/^impl(?:ement)?\b/i, "实现")
    .replace(/^execute\b/i, "执行")
    .replace(/^fix\b/i, "修复")
    .replace(/^refactor\b/i, "重构")
    .replace(/^remove\b/i, "移除")
    .replace(/^add\b/i, "添加")
    .replace(/^create\b/i, "创建")
    .replace(/^build\b/i, "构建")
    .replace(/^run\b/i, "运行")
    .replace(/^audit\b/i, "审计")
    .replace(/^migrate\b/i, "迁移")
    .replace(/^cleanup\b|^clean up\b/i, "清理")
    .replace(/^verify\b/i, "验证")
    .replace(/^use\b/i, "使用")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeGoal(goal: string): GoalSummary {
  const lines = normalizeLines(goal);
  const rawGoal = stripCodeFenceNoise(goal);
  if (!rawGoal) throw new Error("No goal text found. Pass --goal or --goal-file.");

  const routeTokens = [...new Set([...rawGoal.matchAll(/\$[a-z][a-z0-9-]*/g)].map((m) => m[0]))];
  const route = routeTokens.length ? routeTokens.join(", ") : "手动 goal";
  const sources = [...new Set([...rawGoal.matchAll(/(?:^|\s)((?:\.?\/)?(?:docs|\.planning|tasks|specs|tests|src|scripts|packages|server|web)\/[^\s`'")]+)/g)].map((m) => m[1]))];

  const proofLines = lines.filter((line) =>
    /\b(test|verify|verification|visual harness|harness|screenshot|proof|check|make sure|regression|reasonable|works)\b/i.test(line),
  );
  const actionLine =
    lines.find((line) => /\b(impl|implement|execute|fix|refactor|remove|add|create|build|run|audit|migrate|cleanup|clean up)\b/i.test(line)) ??
    lines[0] ??
    "完成请求的 goal";

  const purpose = sentenceCaseAction(actionLine.replace(/\s+via\s+\$[a-z0-9-]+/gi, ""));
  const proof = proofLines.length ? proofLines.map(sentenceCaseAction).join(" ") : "使用 goal 中声明的验证方式或完成定义。";

  return { purpose, route, sources, proof, rawGoal };
}

export function markdownForStart(summary: GoalSummary): string {
  const sources = summary.sources.length ? summary.sources.map((s) => `\`${s}\``).join(", ") : "未在 goal 中明确。";
  return `<!-- multica-goal-tracker:start -->
## Goal 跟踪开始

**目标:** ${summary.purpose}

**执行入口:** ${summary.route}

**来源材料:** ${sources}

**预期验证:** ${summary.proof}

**Goal 命令:**

\`\`\`text
${summary.rawGoal}
\`\`\`
`;
}

export function summaryBlock(summary: GoalSummary): string {
  const sources = summary.sources.length ? summary.sources.map((s) => `\`${s}\``).join(", ") : "未在 goal 中明确。";
  return `<!-- multica-goal-tracker:summary:start -->
## Goal 摘要

**目标:** ${summary.purpose}

**执行入口:** ${summary.route}

**来源材料:** ${sources}

**预期验证:** ${summary.proof}
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

function compactSessionSource(source: string): string {
  const pathMatch = source.match(/(\/[^\s]+)$/);
  if (!pathMatch) return source;
  const path = pathMatch[1];
  const prefix = source.slice(0, source.length - path.length).trim();
  const compactPath = path.split("/").filter(Boolean).slice(-4).join("/");
  return [prefix, compactPath].filter(Boolean).join(" ");
}

function renderEvidence(issue: Issue, summary: GoalSummary, session: SessionEvidence): RenderedEvidence {
  const dir = artifactDir(issue);
  mkdirSync(dir, { recursive: true });
  const htmlPath = join(dir, "completion-card.html");
  const svgPath = join(dir, "completion-card.svg");
  const pngPath = join(dir, "completion-card.png");
  const issueKey = issue.identifier ?? issue.id ?? "Issue";
  const title = issue.title ?? "";
  const status = issue.status ?? "unknown";
  const source = compactSessionSource(session.source);

  const cardInner = `
    <div class="topline">
      <span>${htmlEscape(issueKey)}</span>
      <span>${htmlEscape(status)}</span>
    </div>
    <h1>${htmlEscape(truncate(title, 96))}</h1>
    <div class="body">
      <section>
        <div class="label">Goal 目标</div>
        <p class="clamp-2">${htmlEscape(truncate(summary.purpose, 180))}</p>
      </section>
      <section>
        <div class="label">完成结果</div>
        <p class="clamp-3">${htmlEscape(truncate(session.outcome, 210))}</p>
      </section>
      <section class="grid">
        <div>
          <div class="label">执行入口</div>
          <p class="clamp-1">${htmlEscape(summary.route)}</p>
        </div>
        <div>
          <div class="label">Session 来源</div>
          <p class="clamp-2">${htmlEscape(truncate(source, 130))}</p>
        </div>
      </section>
      <section class="proof">
        <div class="label">验证说明</div>
        <p class="clamp-4">${htmlEscape(truncate(session.proofNote, 280))}</p>
      </section>
    </div>
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
    width: 1280px;
    height: 820px;
    margin: 40px 60px;
    padding: 38px 52px;
    background: #ffffff;
    border: 1px solid #d9dbd2;
    box-shadow: 0 28px 80px rgba(20, 24, 16, 0.16);
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
    margin: 22px 0 20px;
    font-size: 48px;
    line-height: 1.06;
    letter-spacing: 0;
    max-width: 1100px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  section { margin: 0; }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 40px;
  }
  .label {
    color: #606656;
    font-size: 19px;
    font-weight: 720;
    letter-spacing: 0;
    margin-bottom: 6px;
  }
  p {
    margin: 0;
    color: #25291f;
    font-size: 25px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
  .clamp-1,
  .clamp-2,
  .clamp-3,
  .clamp-4 {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .clamp-1 { -webkit-line-clamp: 1; }
  .clamp-2 { -webkit-line-clamp: 2; }
  .clamp-3 { -webkit-line-clamp: 3; }
  .clamp-4 { -webkit-line-clamp: 4; }
  .proof {
    min-height: 126px;
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

export function markdownCodeBlock(value: string, info = "text"): string {
  const longest = Math.max(0, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${info}\n${value}\n${fence}`;
}

export function markdownForFinish(issue: Issue, summary: GoalSummary, session: SessionEvidence, attachment: string): string {
  return `<!-- multica-goal-tracker:finish -->
## Goal 完成记录

**Issue:** ${issue.identifier ?? issue.id ?? "unknown"}

**状态:** ${issue.status ?? "unknown"}

**Session 来源:** ${session.source}

**消息数:** ${session.messageCount}

**完成结果:** ${session.outcome}

**验证说明:** ${session.proofNote}

**证据:** 已附加渲染后的完成卡片；如果 Multica 返回附件 URL，脚本会自动追加一条内联图片回复。

**Goal 目标:** ${summary.purpose}

**Session 摘录:** 完整输出已在下方代码块评论中保留。

本地证据文件: \`${attachment}\`
`;
}

export function markdownForRawSessionOutput(session: SessionEvidence): string {
  return `<!-- multica-goal-tracker:raw-session-output -->
## 真实 session 完成输出

**Session 来源:** ${session.source}

${markdownCodeBlock(session.rawOutput)}
`;
}

export function markdownForInlineImage(url: string): string {
  return `<!-- multica-goal-tracker:evidence-image -->
![completion-card.png](${url})
`;
}

function findImageAttachmentUrl(value: unknown): string | undefined {
  const record = asRecord(value);
  if (record) {
    const contentType = textFromUnknown(record.content_type ?? record.contentType);
    const filename = textFromUnknown(record.filename ?? record.name);
    const url = textFromUnknown(record.url ?? record.download_url ?? record.downloadUrl);
    if (url && (/^image\//i.test(contentType) || /\.(png|jpe?g|webp|gif|svg)$/i.test(filename || url))) {
      return url;
    }
    for (const child of Object.values(record)) {
      const found = findImageAttachmentUrl(child);
      if (found) return found;
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageAttachmentUrl(item);
      if (found) return found;
    }
  }
  return undefined;
}

export function imageAttachmentUrlFromCommentOutput(output: string): string | undefined {
  if (!output.trim()) return undefined;
  try {
    return findImageAttachmentUrl(JSON.parse(output) as unknown);
  } catch {
    return undefined;
  }
}

export function commentIdFromCommentOutput(output: string): string | undefined {
  if (!output.trim()) return undefined;
  try {
    const parsed = JSON.parse(output) as unknown;
    const record = asRecord(parsed);
    const id = record ? textFromUnknown(record.id) : "";
    if (id) return id;
    const nested = record ? asRecord(record.comment ?? record.data) : undefined;
    return nested ? textFromUnknown(nested.id) || undefined : undefined;
  } catch {
    return undefined;
  }
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
    printDryRun("raw session output comment", markdownForRawSessionOutput(session));
    return;
  }

  const commentFile = writeTempMarkdown(evidence.dir, "finish-comment.md", comment);
  const addOutput = runMultica(opts, [
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
  const imageUrl = imageAttachmentUrlFromCommentOutput(addOutput);
  const parent = commentIdFromCommentOutput(addOutput);
  if (imageUrl) {
    const imageCommentFile = writeTempMarkdown(evidence.dir, "finish-image.md", markdownForInlineImage(imageUrl));
    const args = ["issue", "comment", "add", opts.issue!, "--content-file", imageCommentFile, "--output", "json"];
    if (parent) {
      args.push("--parent", parent);
    }
    runMultica(opts, args);
    console.log(`Posted inline evidence image: ${imageUrl}`);
  } else {
    console.warn("WARNING: Multica did not return an image attachment URL; evidence remains attached but not inline.");
  }
  const rawOutputCommentFile = writeTempMarkdown(evidence.dir, "raw-session-output.md", markdownForRawSessionOutput(session));
  const rawOutputArgs = ["issue", "comment", "add", opts.issue!, "--content-file", rawOutputCommentFile, "--output", "json"];
  if (parent) {
    rawOutputArgs.push("--parent", parent);
  }
  runMultica(opts, rawOutputArgs);
  console.log("Posted raw session completion output.");
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
