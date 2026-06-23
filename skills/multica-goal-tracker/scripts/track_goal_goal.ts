export type GoalSummary = {
  purpose: string;
  sourcePurpose: string;
  route: string;
  sources: string[];
  proof: string;
  rawGoal: string;
};

export type PreflightContract = {
  raw: string;
  status?: string;
  taskSource?: string;
  canonicalSource?: string;
  route?: string;
  goal?: string;
  goalCommand: string;
  title: string;
};

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
  for (const match of rawGoal.matchAll(/\b(?:via|with)\s+([a-z][a-z0-9-]*)\b/gi)) {
    const token = match[1].toLowerCase();
    if (token.includes("-")) routeTokens.push(`$${token}`);
  }
  const route = routeTokens.length ? [...new Set(routeTokens)].join(", ") : "手动 goal";
  const sources = [...new Set([...rawGoal.matchAll(/(?:^|\s)((?:\.?\/)?(?:docs|\.planning|tasks|specs|tests|src|scripts|packages|server|web)\/[^\s`'")]+)/g)].map((m) => m[1]))];

  const proofLines = lines.filter((line) =>
    /\b(test|verify|verification|visual harness|harness|screenshot|proof|check|make sure|regression|reasonable|works)\b/i.test(line),
  );
  const actionLine =
    lines.find((line) => /\b(impl|implement|execute|fix|refactor|remove|add|create|build|run|audit|migrate|cleanup|clean up)\b/i.test(line)) ??
    lines[0] ??
    "完成请求的 goal";

  const sourcePurpose = actionLine.replace(/\s+via\s+\$[a-z0-9-]+/gi, "").trim();
  const purpose = sentenceCaseAction(sourcePurpose);
  const proof = proofLines.length ? proofLines.map(sentenceCaseAction).join(" ") : "使用 goal 中声明的验证方式或完成定义。";

  return { purpose, sourcePurpose, route, sources, proof, rawGoal };
}

export function extractGoalFromPreflight(raw: string): string {
  const explicitGoal = fencedBlockAfterHeading(raw, "Main-session /goal prompt");
  if (explicitGoal && /\/goal\b/.test(explicitGoal)) return explicitGoal;

  for (const field of ["Main-session /goal prompt", "To execute"]) {
    const value = preflightField(raw, field);
    if (!value) continue;
    const goal = extractGoal(value);
    if (goal) return goal;
    const line = value.split(/\r?\n/).map((candidate) => candidate.trim()).find((candidate) => /^\/goal\b/i.test(candidate));
    if (line) return line;
  }

  const canonical = preflightField(raw, "Canonical source");
  if (canonical) return `/goal execute ${canonical.split(/\r?\n/)[0].trim()} with intuitive-flow`;
  return "";
}

export function parsePreflightContract(raw: string, titleOverride?: string): PreflightContract {
  const normalized = raw.trim();
  if (!normalized) throw new Error("Preflight input was empty.");
  const status = preflightField(normalized, "Preflight status");
  if (/BLOCKED_NEEDS_DECISION/i.test(status)) {
    throw new Error("Preflight status is BLOCKED_NEEDS_DECISION; approve or revise the contract before creating a tracked issue.");
  }
  const goalCommand = extractGoalFromPreflight(normalized);
  if (!goalCommand) {
    throw new Error("No /goal command found in preflight. Include Main-session /goal prompt or To execute.");
  }
  const summary = summarizeGoal(goalCommand);
  const canonicalSource = preflightField(normalized, "Canonical source");
  const title = titleOverride?.trim() || (canonicalSource ? titleFromCanonicalSource(canonicalSource) : titleFromGoalSummary(summary));
  return {
    raw: normalized,
    status: status || undefined,
    taskSource: preflightField(normalized, "Task source") || undefined,
    canonicalSource: canonicalSource || undefined,
    route: preflightField(normalized, "Route") || undefined,
    goal: preflightField(normalized, "Goal") || undefined,
    goalCommand: summary.rawGoal,
    title: title || "Tracked Goal",
  };
}

function preflightField(raw: string, label: string): string {
  const lines = raw.split(/\r?\n/);
  const escaped = escapeRegExp(label);
  const start = lines.findIndex((line) => new RegExp(`^${escaped}\\s*:\\s*`, "i").test(line.trim()));
  if (start < 0) return "";

  const first = lines[start].replace(new RegExp(`^${escaped}\\s*:\\s*`, "i"), "").trim();
  const values = first ? [first] : [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^[A-Z][A-Za-z /-]{1,80}\s*:/.test(line.trim())) break;
    if (/^Approval gate\s*:/.test(line.trim())) break;
    values.push(line);
  }
  return values.join("\n").trim();
}

function fencedBlockAfterHeading(raw: string, heading: string): string {
  const headingIndex = raw.search(new RegExp(`^${escapeRegExp(heading)}\\s*:`, "im"));
  if (headingIndex < 0) return "";
  const after = raw.slice(headingIndex);
  const fence = after.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
  return fence ? fence[1].trim() : "";
}

function titleFromCanonicalSource(canonicalSource: string): string {
  const value = canonicalSource.split(/\r?\n/)[0].trim();
  const pathMatch = value.match(/(?:^|\s)((?:docs|\.planning|tasks|specs)\/[^\s`'")]+)/);
  const source = pathMatch ? pathMatch[1] : value;
  const base = source.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? source;
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function titleFromGoalSummary(summary: GoalSummary): string {
  const source = summary.sources[0];
  if (source) return titleFromCanonicalSource(source);
  return truncate(summary.purpose.replace(/^\S+\s+/, ""), 80) || truncate(summary.purpose, 80) || "Tracked Goal";
}

function stripCodeFenceNoise(text: string): string {
  return text
    .replace(/```[a-zA-Z0-9_-]*\n/g, "")
    .replace(/```/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function timestampFromRecord(value: unknown): number | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  for (const key of ["created_at", "createdAt", "updated_at", "updatedAt"]) {
    const raw = record[key];
    if (typeof raw === "string") {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncate(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function textFromUnknown(value: unknown): string {
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
