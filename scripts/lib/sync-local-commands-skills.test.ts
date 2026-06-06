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
import { parseManifestText } from "./local-skill-manifest";

const repoRoot = process.cwd();

const createNpxStub = (home: string) => {
  const stubBin = join(home, "stub-bin");
  const npxPath = join(stubBin, "npx");
  const npxLog = join(home, "npx.log");

  mkdirSync(stubBin, { recursive: true });
  writeFileSync(
    npxPath,
    `#!/bin/bash
printf '%s\\n' "$*" >> "${npxLog}"
exit 0
`,
  );
  chmodSync(npxPath, 0o755);

  return { npxLog, stubBin };
};

const syncEnv = (home: string, stubBin: string) => ({
  ...process.env,
  HOME: home,
  PATH: `${stubBin}${delimiter}${process.env.PATH ?? ""}`,
});

describe("local command and skill sync task", () => {
  test("syncs manifest-owned root skills into a temp Codex skills directory", async () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-home-"));
    try {
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      const { npxLog, stubBin } = createNpxStub(home);
      const manifest = parseManifestText(await Bun.file(join(repoRoot, "scripts", "local-skill-manifest.txt")).text());

      const result = spawnSync("bash", ["scripts/tasks/sync-local-commands-skills.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: syncEnv(home, stubBin),
      });

      if (result.status !== 0) {
        throw new Error(`sync failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
      }

      expect(manifest.rootSkills.length).toBeGreaterThan(0);
      const npxCalls = await Bun.file(npxLog).text();
      for (const skillName of manifest.rootSkills) {
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

  test("fails through the sync path when root skill manifest drift exists", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-drift-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-skills-project-"));
    try {
      const { stubBin } = createNpxStub(home);
      mkdirSync(join(fixture, "scripts", "lib"), { recursive: true });
      mkdirSync(join(fixture, "skills", "listed"), { recursive: true });
      mkdirSync(join(fixture, "skills", "unlisted"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "local-skill-manifest.txt"), "root-skill listed\n");
      writeFileSync(join(fixture, "skills", "listed", "SKILL.md"), "# Listed\n");
      writeFileSync(join(fixture, "skills", "unlisted", "SKILL.md"), "# Unlisted\n");
      copyFileSync(
        join(repoRoot, "scripts", "lib", "local-skill-manifest.ts"),
        join(fixture, "scripts", "lib", "local-skill-manifest.ts"),
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
      expect(result.stderr).toContain("root skill missing from manifest: unlisted");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("records owned root skills and prunes only previously owned removals", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-owned-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-skills-project-"));
    try {
      const { stubBin } = createNpxStub(home);
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      mkdirSync(join(fixture, "scripts", "lib"), { recursive: true });
      mkdirSync(join(fixture, "skills", "alpha"), { recursive: true });
      mkdirSync(join(fixture, "skills", "beta"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "local-skill-manifest.txt"), "root-skill alpha\nroot-skill beta\n");
      writeFileSync(join(fixture, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: Alpha skill.\n---\n");
      writeFileSync(join(fixture, "skills", "beta", "SKILL.md"), "---\nname: beta\ndescription: Beta skill.\n---\n");
      copyFileSync(
        join(repoRoot, "scripts", "lib", "local-skill-manifest.ts"),
        join(fixture, "scripts", "lib", "local-skill-manifest.ts"),
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

      writeFileSync(join(fixture, "scripts", "local-skill-manifest.txt"), "root-skill alpha\n");
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
