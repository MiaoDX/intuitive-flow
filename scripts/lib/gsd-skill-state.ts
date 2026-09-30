#!/usr/bin/env bun

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { gsdSkillsForInstall, readDefaultSkillAllowlist } from "./default-skill-allowlist";
import { isSafeName, readState, removeIfExists, stateDir, writeState } from "./managed-skill-state-common";

const gsdStatePath = (home: string) => join(stateDir(home), "gsd-skills.json");

const ensureClaudeExplicitOnly = (path: string): void => {
  if (!existsSync(path)) {
    return;
  }

  const text = readFileSync(path, "utf8");
  if (!text.startsWith("---\n")) {
    return;
  }

  if (/^disable-model-invocation:\s*true\s*$/m.test(text)) {
    return;
  }

  const end = text.indexOf("\n---\n", 4);
  if (end === -1) {
    return;
  }

  const updated = `${text.slice(0, end)}\ndisable-model-invocation: true${text.slice(end)}`;
  writeFileSync(path, updated);
};

const ensureCodexExplicitOnly = (skillDir: string): void => {
  const path = join(skillDir, "agents", "openai.yaml");
  mkdirSync(join(skillDir, "agents"), { recursive: true });
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";

  if (/^\s+allow_implicit_invocation:\s*false\s*$/m.test(text)) {
    return;
  }

  const updated = /^\s+allow_implicit_invocation:\s*/m.test(text)
    ? text.replace(/^\s+allow_implicit_invocation:.*$/m, "  allow_implicit_invocation: false")
    : `${text.replace(/\s*$/, "")}\npolicy:\n  allow_implicit_invocation: false\n`;
  writeFileSync(path, updated);
};

const enforceExplicitInvocationPolicy = (
  roots: string[],
  claudeRoot: string,
  desiredSkills: string[],
): void => {
  for (const root of roots) {
    const isClaude = root === claudeRoot;
    for (const skillName of desiredSkills) {
      const skillDir = join(root, skillName);
      const skillPath = join(skillDir, "SKILL.md");
      if (!existsSync(skillPath)) {
        continue;
      }

      if (isClaude) {
        ensureClaudeExplicitOnly(skillPath);
      } else {
        ensureCodexExplicitOnly(skillDir);
      }
    }
  }
};

const removeGsdSkillIfManaged = (path: string): number => {
  const skillPath = join(path, "SKILL.md");
  if (!existsSync(skillPath)) {
    return 0;
  }

  try {
    const text = readFileSync(skillPath, "utf8");
    const isGsdHostAdapter = /^name:\s*["']?gsd-[a-z0-9-]+["']?\s*$/m.test(text)
      && text.includes("allowed-tools:");
    if (!text.includes("get-shit-done") && !text.includes("<codex_skill_adapter>") && !isGsdHostAdapter) {
      return 0;
    }
  } catch {
    return 0;
  }

  return removeIfExists(path);
};

export const syncGsdSkillState = (
  allowlistPath: string,
  home = process.env.HOME ?? "",
  codexHome = process.env.CODEX_HOME ?? join(home, ".codex"),
): number => {
  if (home === "") {
    throw new Error("HOME is required for GSD skill state");
  }

  const desiredSkills = gsdSkillsForInstall(readDefaultSkillAllowlist(allowlistPath)).filter(isSafeName).sort();
  const desired = new Set(desiredSkills);
  const statePath = gsdStatePath(home);
  const previous = readState(statePath);
  const skillRoots = [...new Set([
    join(codexHome, "skills"),
    join(home, ".agents", "skills"),
    join(home, ".claude", "skills"),
  ])];
  let removed = 0;

  if (previous) {
    for (const skillName of previous.skills) {
      if (desired.has(skillName)) {
        continue;
      }

      for (const root of skillRoots) {
        removed += removeGsdSkillIfManaged(join(root, skillName));
      }
    }
  }

  for (const root of skillRoots) {
    if (!existsSync(root)) {
      continue;
    }
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith("gsd-") || !isSafeName(entry) || desired.has(entry)) {
        continue;
      }
      removed += removeGsdSkillIfManaged(join(root, entry));
    }
  }

  enforceExplicitInvocationPolicy(skillRoots, join(home, ".claude", "skills"), desiredSkills);

  writeState(statePath, {
    schemaVersion: 1,
    source: "opengsd/gsd-core",
    skills: desiredSkills,
  });

  return removed;
};

const usage = () => {
  console.error("Usage: gsd-skill-state.ts sync <allowlist>");
};

const main = () => {
  const [command, allowlistPath] = process.argv.slice(2);

  try {
    if (command !== "sync" || !allowlistPath) {
      usage();
      process.exit(2);
    }

    const removed = syncGsdSkillState(allowlistPath);
    if (removed > 0) {
      console.log(`  ✓ removed ${removed} stale GSD skill artifact(s)`);
    }
  } catch (error) {
    console.error(`  ! ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

if (import.meta.main) {
  main();
}
