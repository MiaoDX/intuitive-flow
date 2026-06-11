import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { parseDefaultSkillAllowlistText } from "./default-skill-allowlist";

const repoRoot = process.cwd();

const createCliStubs = (home: string) => {
  const stubBin = join(home, "stub-bin");
  const npmPath = join(stubBin, "npm");
  const npmLog = join(home, "npm.log");
  const npxPath = join(stubBin, "npx");
  const npxLog = join(home, "npx.log");

  mkdirSync(stubBin, { recursive: true });
  writeFileSync(
    npmPath,
    `#!/bin/bash
printf '%s\\n' "$*" >> "${npmLog}"

if [ "$1" = "view" ] && [ "$3" = "version" ]; then
  printf '0.0.0-test\\n'
  exit 0
fi

echo "unexpected npm call: $*" >&2
exit 1
`,
  );
  writeFileSync(
    npxPath,
    `#!/bin/bash
printf '%s\\n' "$*" >> "${npxLog}"
exit 0
`,
  );
  chmodSync(npmPath, 0o755);
  chmodSync(npxPath, 0o755);

  return { npmLog, npxLog, stubBin };
};

const syncEnv = (home: string, stubBin: string) => ({
  ...process.env,
  HOME: home,
  PATH: `${stubBin}${delimiter}${process.env.PATH ?? ""}`,
});

describe("local command and skill sync task", () => {
  test("renders Codex command adapters without native spawn_agent fanout", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-command-adapter-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-command-adapter-project-"));
    try {
      const { stubBin } = createCliStubs(home);
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      mkdirSync(join(fixture, ".claude", "commands"), { recursive: true });
      mkdirSync(join(fixture, "scripts", "lib"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "");
      writeFileSync(
        join(fixture, ".claude", "commands", "sample.md"),
        [
          "---",
          "description: Sample command.",
          "---",
          "",
          "Use Task(subagent_type=\"worker\", prompt=\"do work\") when useful.",
          "",
        ].join("\n"),
      );
      copyFileSync(
        join(repoRoot, "scripts", "lib", "default-skill-allowlist.ts"),
        join(fixture, "scripts", "lib", "default-skill-allowlist.ts"),
      );

      const result = spawnSync(
        "bash",
        [
          "-c",
          'SCRIPT_DIR="$1"; source scripts/tasks/sync-local-commands-skills.sh; run_sync_local_commands_skills',
          "bash",
          join(fixture, "scripts"),
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
          env: syncEnv(home, stubBin),
        },
      );

      if (result.status !== 0) {
        throw new Error(`sync failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
      }

      const skillText = readFileSync(join(home, ".codex", "skills", "sample", "SKILL.md"), "utf8");
      expect(skillText).toContain("skill-runner/references/codex-delegation.md");
      expect(skillText).toContain("Paseo-managed agent");
      expect(skillText).toContain("do not use native subagents by default");
      expect(skillText).not.toContain("spawn_agent(agent_type=");
      expect(skillText).not.toContain("collect agent IDs");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("syncs allowlist-owned root skills into a temp Codex skills directory", async () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-home-"));
    try {
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      const { npmLog, npxLog, stubBin } = createCliStubs(home);
      const allowlist = parseDefaultSkillAllowlistText(await Bun.file(join(repoRoot, "scripts", "default-skill-allowlist.txt")).text());

      const result = spawnSync("bash", ["scripts/tasks/sync-local-commands-skills.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: syncEnv(home, stubBin),
      });

      if (result.status !== 0) {
        throw new Error(`sync failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
      }

      expect(allowlist.rootSkills.length).toBeGreaterThan(0);
      const npmCalls = await Bun.file(npmLog).text();
      expect(npmCalls).toContain("view skills version");
      const npxCalls = await Bun.file(npxLog).text();
      for (const skillName of allowlist.rootSkills) {
        expect(existsSync(join(home, ".codex", "skills", skillName, "SKILL.md"))).toBe(true);
        expect(existsSync(join(home, ".codex", "skills", skillName, skillName, "SKILL.md"))).toBe(false);
        expect(npxCalls).toContain(join(repoRoot, "skills", skillName));

        const commandPath = join(home, ".config", "mimocode", "command", `${skillName}.md`);
        expect(existsSync(commandPath)).toBe(true);
        const commandText = await Bun.file(commandPath).text();
        expect(commandText).toContain("description:");
        expect(commandText).toContain(`Load and run the \`${skillName}\` skill.`);
        expect(commandText).toContain("User input: $ARGUMENTS");
        // description must be resolved, not a bare YAML block-scalar marker
        const descLine = commandText.split("\n").find((l) => l.startsWith("description:")) ?? "";
        expect(descLine).not.toBe('description: "|"');
        expect(descLine).not.toBe('description: ">"');
        expect(descLine.length).toBeGreaterThan("description: \"\"".length + 5);
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("fails through the sync path when root skill allowlist drift exists", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-drift-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-skills-project-"));
    try {
      const { stubBin } = createCliStubs(home);
      mkdirSync(join(fixture, "scripts", "lib"), { recursive: true });
      mkdirSync(join(fixture, "skills", "listed"), { recursive: true });
      mkdirSync(join(fixture, "skills", "unlisted"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill listed\n");
      writeFileSync(join(fixture, "skills", "listed", "SKILL.md"), "# Listed\n");
      writeFileSync(join(fixture, "skills", "unlisted", "SKILL.md"), "# Unlisted\n");
      copyFileSync(
        join(repoRoot, "scripts", "lib", "default-skill-allowlist.ts"),
        join(fixture, "scripts", "lib", "default-skill-allowlist.ts"),
      );

      const result = spawnSync(
        "bash",
        [
          "-c",
          'SCRIPT_DIR="$1"; source scripts/tasks/sync-local-commands-skills.sh; run_sync_local_commands_skills',
          "bash",
          join(fixture, "scripts"),
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
          env: syncEnv(home, stubBin),
        },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("root skill missing from default allowlist: unlisted");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("ignores legacy .claude/skills entries outside the root allowlist", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-legacy-claude-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-skills-project-"));
    try {
      const { npxLog, stubBin } = createCliStubs(home);
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      mkdirSync(join(fixture, "scripts", "lib"), { recursive: true });
      mkdirSync(join(fixture, "skills", "alpha"), { recursive: true });
      mkdirSync(join(fixture, ".claude", "skills", "legacy-local"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill alpha\n");
      writeFileSync(join(fixture, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: Alpha skill.\n---\n");
      writeFileSync(join(fixture, ".claude", "skills", "legacy-local", "SKILL.md"), "---\nname: legacy-local\ndescription: Legacy local skill.\n---\n");
      copyFileSync(
        join(repoRoot, "scripts", "lib", "default-skill-allowlist.ts"),
        join(fixture, "scripts", "lib", "default-skill-allowlist.ts"),
      );

      const result = spawnSync(
        "bash",
        [
          "-c",
          'SCRIPT_DIR="$1"; source scripts/tasks/sync-local-commands-skills.sh; run_sync_local_commands_skills',
          "bash",
          join(fixture, "scripts"),
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
          env: syncEnv(home, stubBin),
        },
      );

      if (result.status !== 0) {
        throw new Error(`sync failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
      }

      const npxCalls = readFileSync(npxLog, "utf8");
      expect(npxCalls).toContain(join(fixture, "skills", "alpha"));
      expect(npxCalls).not.toContain("legacy-local");
      expect(existsSync(join(home, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "legacy-local"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("records owned root skills and prunes only previously owned removals", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-owned-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-skills-project-"));
    try {
      const { stubBin } = createCliStubs(home);
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      mkdirSync(join(fixture, "scripts", "lib"), { recursive: true });
      mkdirSync(join(fixture, "skills", "alpha"), { recursive: true });
      mkdirSync(join(fixture, "skills", "beta"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill alpha\nroot-skill beta\n");
      writeFileSync(join(fixture, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: Alpha skill.\n---\n");
      writeFileSync(join(fixture, "skills", "beta", "SKILL.md"), "---\nname: beta\ndescription: Beta skill.\n---\n");
      copyFileSync(
        join(repoRoot, "scripts", "lib", "default-skill-allowlist.ts"),
        join(fixture, "scripts", "lib", "default-skill-allowlist.ts"),
      );

      const runSync = () => spawnSync(
        "bash",
        [
          "-c",
          'SCRIPT_DIR="$1"; source scripts/tasks/sync-local-commands-skills.sh; run_sync_local_commands_skills',
          "bash",
          join(fixture, "scripts"),
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
          env: syncEnv(home, stubBin),
        },
      );

      const first = runSync();
      if (first.status !== 0) {
        throw new Error(`first sync failed\nstdout:\n${first.stdout}\nstderr:\n${first.stderr}`);
      }

      expect(existsSync(join(home, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "beta", "SKILL.md"))).toBe(true);
      expect(JSON.parse(readFileSync(join(home, ".intuitive-flow", "owned-root-skills.json"), "utf8"))).toEqual({
        schemaVersion: 1,
        rootSkills: ["alpha", "beta"],
      });

      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill alpha\n");
      rmSync(join(fixture, "skills", "beta"), { recursive: true, force: true });
      mkdirSync(join(home, ".codex", "skills", "user-skill"), { recursive: true });
      writeFileSync(join(home, ".codex", "skills", "user-skill", "SKILL.md"), "# User skill\n");

      const second = runSync();
      if (second.status !== 0) {
        throw new Error(`second sync failed\nstdout:\n${second.stdout}\nstderr:\n${second.stderr}`);
      }

      expect(existsSync(join(home, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "beta"))).toBe(false);
      expect(existsSync(join(home, ".codex", "skills", "user-skill", "SKILL.md"))).toBe(true);
      expect(JSON.parse(readFileSync(join(home, ".intuitive-flow", "owned-root-skills.json"), "utf8"))).toEqual({
        schemaVersion: 1,
        rootSkills: ["alpha"],
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
