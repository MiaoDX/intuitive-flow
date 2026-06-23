import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type SkillState = {
  schemaVersion: 1;
  source: string;
  skills: string[];
};

export const stateDir = (home: string) => join(home, ".intuitive-flow");

export const skillInstallRoots = (home: string) => [
  join(home, ".codex", "skills"),
  join(home, ".agents", "skills"),
  join(home, ".claude", "skills"),
];

export const isSafeName = (value: string) => /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(value) && !value.includes("..");

export const readState = (path: string): SkillState | null => {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<SkillState>;
    if (parsed.schemaVersion !== 1 || typeof parsed.source !== "string" || !Array.isArray(parsed.skills)) {
      return null;
    }

    return {
      schemaVersion: 1,
      source: parsed.source,
      skills: parsed.skills.filter((skillName): skillName is string => (
        typeof skillName === "string" && isSafeName(skillName)
      )),
    };
  } catch {
    return null;
  }
};

export const writeState = (path: string, state: SkillState) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
};

export const removeIfExists = (path: string): number => {
  try {
    lstatSync(path);
  } catch {
    return 0;
  }

  rmSync(path, { recursive: true, force: true });
  return 1;
};
