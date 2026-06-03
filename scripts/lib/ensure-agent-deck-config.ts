#!/usr/bin/env bun

import { dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

type Setting = {
  section: string;
  key: string;
  value: string;
};

const settings: Setting[] = [
  { section: "", key: "default_tool", value: '"codex"' },
  { section: "instances", key: "allow_multiple", value: "true" },
  { section: "tmux", key: "socket_name", value: '"agent-deck"' },
  { section: "tmux", key: "inject_status_line", value: "true" },
  { section: "tmux", key: "mouse", value: "true" },
  { section: "updates", key: "auto_update", value: "false" },
  { section: "updates", key: "check_enabled", value: "false" },
  { section: "global_search", key: "enabled", value: "true" },
  { section: "global_search", key: "tier", value: '"balanced"' },
  { section: "global_search", key: "memory_limit_mb", value: "100" },
  { section: "global_search", key: "recent_days", value: "90" },
  { section: "global_search", key: "index_rate_limit", value: "10" },
  { section: "mcp_pool", key: "enabled", value: "false" },
  { section: "docker", key: "default_enabled", value: "false" },
  { section: "worktree", key: "default_enabled", value: "false" },
  { section: "worktree", key: "default_location", value: '"subdirectory"' },
];

const sectionOrder = ["", "instances", "tmux", "updates", "global_search", "mcp_pool", "docker", "worktree"];

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sectionName = (line: string) => {
  const match = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
  return match ? match[1]!.trim() : null;
};

const isSectionHeader = (line: string) => sectionName(line) !== null;

const keyPattern = (key: string) => new RegExp(`^\\s*${escapeRegex(key)}\\s*=`);

const groupSettings = () => {
  const grouped = new Map<string, Setting[]>();
  for (const section of sectionOrder) {
    grouped.set(section, []);
  }
  for (const setting of settings) {
    grouped.get(setting.section)?.push(setting);
  }
  return grouped;
};

const formatSettings = (items: Setting[]) => items.map((setting) => `${setting.key} = ${setting.value}`);

const findSectionStart = (lines: string[], name: string) =>
  lines.findIndex((line) => sectionName(line) === name);

const firstSectionIndex = (lines: string[]) => {
  const index = lines.findIndex(isSectionHeader);
  return index === -1 ? lines.length : index;
};

const sectionRange = (lines: string[], name: string) => {
  const start = name === "" ? 0 : findSectionStart(lines, name);
  if (start === -1) {
    return null;
  }

  const valueStart = name === "" ? 0 : start + 1;
  const valueEnd =
    name === "" ? firstSectionIndex(lines) : lines.findIndex((line, index) => index > start && isSectionHeader(line));

  return { start, valueStart, valueEnd: valueEnd === -1 ? lines.length : valueEnd };
};

const hasAssignment = (lines: string[], section: string, key: string) => {
  const range = sectionRange(lines, section);
  if (!range) {
    return false;
  }

  return lines.slice(range.valueStart, range.valueEnd).some((line) => keyPattern(key).test(line));
};

const insertTopLevelSettings = (lines: string[], items: Setting[]) => {
  if (items.length === 0) {
    return;
  }

  while (lines[0]?.trim() === "") {
    lines.shift();
  }

  const topEnd = firstSectionIndex(lines);
  let insertAt = 0;
  while (insertAt < topEnd && /^\s*(?:#.*)?$/.test(lines[insertAt] ?? "")) {
    insertAt += 1;
  }

  const formatted = formatSettings(items);
  lines.splice(insertAt, 0, ...formatted);

  const nextLine = lines[insertAt + formatted.length];
  if (nextLine !== undefined && nextLine.trim() !== "" && isSectionHeader(nextLine)) {
    lines.splice(insertAt + formatted.length, 0, "");
  }
};

const insertSectionSettings = (lines: string[], section: string, items: Setting[]) => {
  if (items.length === 0) {
    return;
  }

  const formatted = formatSettings(items);
  const start = findSectionStart(lines, section);
  if (start !== -1) {
    lines.splice(start + 1, 0, ...formatted);
    return;
  }

  if (lines.length > 0 && lines[lines.length - 1]?.trim() !== "") {
    lines.push("");
  }
  lines.push(`[${section}]`, ...formatted);
};

export const ensureAgentDeckConfigText = (original: string) => {
  const normalized = original.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  const lines = normalized === "" ? [] : normalized.split("\n");
  const grouped = groupSettings();
  const nextLines = [...lines];

  insertTopLevelSettings(
    nextLines,
    (grouped.get("") ?? []).filter((setting) => !hasAssignment(nextLines, "", setting.key)),
  );
  for (const section of sectionOrder.filter((name) => name !== "")) {
    insertSectionSettings(
      nextLines,
      section,
      (grouped.get(section) ?? []).filter((setting) => !hasAssignment(nextLines, section, setting.key)),
    );
  }

  return `${nextLines.join("\n").replace(/\n+$/, "")}\n`;
};

if (import.meta.main) {
  const configPath = process.argv[2];

  if (!configPath) {
    console.error("Usage: ensure-agent-deck-config.ts <config-path>");
    process.exit(1);
  }

  mkdirSync(dirname(configPath), { recursive: true });
  const original = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  writeFileSync(configPath, ensureAgentDeckConfigText(original));
}
