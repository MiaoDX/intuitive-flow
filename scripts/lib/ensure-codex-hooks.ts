#!/usr/bin/env bun

import { dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

type JsonRecord = Record<string, unknown>;

type HookEntry = {
  matcher?: string;
  hooks: JsonRecord[];
  [key: string]: unknown;
};

const managedCommand = (pluginDir: string, event: string) => `bash ${pluginDir}/hooks/codex-hook.sh ${event}`;

const managedEntries = (pluginDir: string): Record<string, HookEntry[]> => ({
  SessionStart: [
    {
      matcher: "startup|resume",
      hooks: [{ type: "command", command: managedCommand(pluginDir, "SessionStart") }],
    },
  ],
  UserPromptSubmit: [
    {
      hooks: [{ type: "command", command: managedCommand(pluginDir, "UserPromptSubmit") }],
    },
  ],
  PreToolUse: [
    {
      matcher: "Bash",
      hooks: [{ type: "command", command: managedCommand(pluginDir, "PreToolUse") }],
    },
  ],
  Stop: [
    {
      hooks: [{ type: "command", command: managedCommand(pluginDir, "Stop") }],
    },
  ],
});

const asRecord = (value: unknown): JsonRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : undefined;

const normalizeEntry = (entry: unknown): HookEntry | undefined => {
  const record = asRecord(entry);
  if (!record || !Array.isArray(record.hooks)) {
    return undefined;
  }

  const hooks = record.hooks.filter((hook): hook is JsonRecord => asRecord(hook) !== undefined);
  return { ...record, hooks, matcher: typeof record.matcher === "string" ? record.matcher : undefined };
};

const entryHasCommand = (entry: HookEntry, command: string) =>
  entry.hooks.some((hook) => hook.type === "command" && hook.command === command);

const upsertManagedEntry = (entries: HookEntry[], managed: HookEntry) => {
  const command = managed.hooks
    .map((hook) => (typeof hook.command === "string" ? hook.command : ""))
    .find(Boolean);

  if (!command || entries.some((entry) => entryHasCommand(entry, command))) {
    return entries;
  }

  return [...entries, managed];
};

export const ensureCodexHooksText = (original: string, pluginDir: string) => {
  let root: JsonRecord = {};

  if (original.trim()) {
    try {
      const parsed = JSON.parse(original) as unknown;
      root = asRecord(parsed) ?? {};
    } catch {
      root = {};
    }
  }

  const existingHooks = asRecord(root.hooks) ?? {};
  const nextHooks: Record<string, HookEntry[]> = {};

  for (const [event, value] of Object.entries(existingHooks)) {
    nextHooks[event] = Array.isArray(value) ? value.map(normalizeEntry).filter((entry): entry is HookEntry => entry !== undefined) : [];
  }

  for (const [event, entries] of Object.entries(managedEntries(pluginDir))) {
    const existing = nextHooks[event] ?? [];
    nextHooks[event] = entries.reduce(upsertManagedEntry, existing);
  }

  return `${JSON.stringify({ ...root, hooks: nextHooks }, null, 2)}\n`;
};

if (import.meta.main) {
  const hooksPath = process.argv[2];
  const pluginDir = process.argv[3];

  if (!hooksPath || !pluginDir) {
    console.error("Usage: ensure-codex-hooks.ts <hooks-path> <tmux-agent-status-plugin-dir>");
    process.exit(1);
  }

  mkdirSync(dirname(hooksPath), { recursive: true });
  const original = existsSync(hooksPath) ? readFileSync(hooksPath, "utf8") : "";
  writeFileSync(hooksPath, ensureCodexHooksText(original, pluginDir));
}
