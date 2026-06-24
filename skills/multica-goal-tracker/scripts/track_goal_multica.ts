import { homedir } from "node:os";

export type Issue = {
  identifier?: string;
  id?: string;
  workspace_id?: string;
  workspaceId?: string;
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  updated_at?: string;
};

export type MulticaWorkspace = {
  id: string;
  name: string;
  slug?: string;
};

type JsonRecord = Record<string, unknown>;

type MulticaEnvOptions = {
  workspaceId?: string;
  [key: string]: unknown;
};

export function multicaEnv(opts: MulticaEnvOptions): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${homedir()}/.local/bin:${process.env.PATH ?? ""}` };
  if (opts.workspaceId) {
    env.MULTICA_WORKSPACE_ID = opts.workspaceId;
  }
  return env;
}

export function parseWorkspaceListOutput(output: string): MulticaWorkspace[] {
  try {
    const parsed = JSON.parse(output.trim()) as unknown;
    const items = Array.isArray(parsed) ? parsed : nestedArray(parsed, ["workspaces", "items"]);
    return items.reduce<MulticaWorkspace[]>((workspaces, item) => {
      const record = asRecord(item);
      const id = textFromUnknown(record?.id).trim();
      const name = textFromUnknown(record?.name).trim();
      const slug = textFromUnknown(record?.slug).trim();
      if (id && name) {
        workspaces.push({ id, name, slug: slug || undefined });
      }
      return workspaces;
    }, []);
  } catch {
    // Fall through to table parsing for older CLI output.
  }

  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.reduce<MulticaWorkspace[]>((workspaces, line) => {
    if (/^(?:ID\s+NAME|[*]\s*=|Tip:)/i.test(line)) return workspaces;
    const normalized = line.replace(/^\*\s*/, "");
    const columns = normalized.split(/\s{2,}/).map((column) => column.trim()).filter(Boolean);
    const [id, name, slug] = columns;
    if (id && name && /^[0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i.test(id)) {
      workspaces.push({ id, name, slug });
    }
    return workspaces;
  }, []);
}

export function resolveWorkspaceIdFromList(requested: string, workspaces: MulticaWorkspace[]): string {
  const token = workspaceTokenFromUrlOrPath(requested);
  if (!token) return "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return token;
  }

  const normalized = slugifyWorkspaceName(token);
  const matches = workspaces.filter((workspace) => {
    const name = workspace.name.trim();
    const slug = workspace.slug?.trim() ?? "";
    return (
      name.toLowerCase() === token.toLowerCase() ||
      slug.toLowerCase() === token.toLowerCase() ||
      slugifyWorkspaceName(name) === normalized ||
      slugifyWorkspaceName(slug) === normalized ||
      workspace.id.toLowerCase() === token.toLowerCase()
    );
  });

  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    throw new Error(`Ambiguous Multica workspace '${requested}'. Use the workspace UUID explicitly.`);
  }
  return "";
}

export function issueIdentifierFromCreateOutput(output: string): string | undefined {
  const parsed = jsonFromCliOutput(output);
  const record = asRecord(parsed);
  if (!record) return undefined;
  return textFromUnknown(record.identifier ?? record.key ?? record.id) || undefined;
}

export function issueWorkspaceIdFromCreateOutput(output: string): string | undefined {
  const parsed = jsonFromCliOutput(output);
  const record = asRecord(parsed);
  if (!record) return undefined;
  return textFromUnknown(record.workspace_id ?? record.workspaceId) || undefined;
}

export function assertIssueWorkspace(issue: Issue, expectedWorkspaceId: string, context: string) {
  const actualWorkspaceId = issue.workspace_id ?? issue.workspaceId;
  if (actualWorkspaceId && actualWorkspaceId !== expectedWorkspaceId) {
    throw new Error(
      `${context} belongs to workspace ${actualWorkspaceId}, but tracker target was ${expectedWorkspaceId}. Refusing to continue in the wrong workspace.`,
    );
  }
}

export function jsonFromCliOutput(output: string): unknown {
  const trimmed = output.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // The Multica CLI can print progress lines before/after JSON even with
    // --output json.
  }

  const start = trimmed.search(/[\[{]/);
  if (start < 0) throw new Error("No JSON payload found in CLI output.");
  const opener = trimmed[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === opener) depth += 1;
    if (char === closer) depth -= 1;
    if (depth === 0) {
      return JSON.parse(trimmed.slice(start, i + 1)) as unknown;
    }
  }
  throw new Error("Unterminated JSON payload in CLI output.");
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

export function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : undefined;
}

function runIdFromRun(run: unknown): string {
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

function slugifyWorkspaceName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function workspaceTokenFromUrlOrPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const segment = url.pathname.split("/").filter(Boolean)[0];
    if (segment) return segment;
  } catch {
    // Not a URL; fall through to path/token handling.
  }

  const pathMatch = trimmed.match(/(?:^|\/)([a-z0-9][a-z0-9-]*)(?:\/(?:issues?|projects?|repos?|$)|\/?$)/i);
  if (pathMatch?.[1]) return pathMatch[1];
  return trimmed;
}
