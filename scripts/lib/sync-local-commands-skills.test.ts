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
import { parseDefaultSkillAllowlistText, parsePruneLedgerText } from "./default-skill-allowlist";

const repoRoot = process.cwd();

const createCliStubs = (home: string, options: { failNpx?: boolean } = {}) => {
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
${options.failNpx ? "exit 42" : "exit 0"}
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

const copySyncTaskHelpers = (fixture: string) => {
  const libDir = join(fixture, "scripts", "lib");
  mkdirSync(libDir, { recursive: true });
  for (const helper of [
    "default-skill-allowlist.ts",
    "managed-skill-state-common.ts",
    "managed-skill-state.ts",
    "owned-root-skill-state.ts",
  ]) {
    copyFileSync(join(repoRoot, "scripts", "lib", helper), join(libDir, helper));
  }
};

const prepareSyncTaskFixture = (fixture: string) => {
  mkdirSync(join(fixture, "scripts"), { recursive: true });
};

describe("local command and skill sync task", () => {
  test("syncs allowlist-owned root skills into a temp Codex skills directory", async () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-home-"));
    try {
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      const { npmLog, npxLog, stubBin } = createCliStubs(home);
      const allowlist = parseDefaultSkillAllowlistText(await Bun.file(join(repoRoot, "scripts", "default-skill-allowlist.txt")).text());
      const pruneLedger = parsePruneLedgerText(await Bun.file(join(repoRoot, "scripts", "default-skill-prune-ledger.txt")).text());

      const result = spawnSync("bash", ["scripts/tasks/sync-local-commands-skills.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: syncEnv(home, stubBin),
      });

      if (result.status !== 0) {
        throw new Error(`sync failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
      }

      expect(allowlist.rootSkills.length).toBeGreaterThan(0);
      expect(allowlist.rootSkills).toContain("agent-planning-loop");
      for (const legacySkill of pruneLedger.legacySkills) {
        expect(allowlist.rootSkills).not.toContain(legacySkill);
      }
      const npmCalls = await Bun.file(npmLog).text();
      expect(npmCalls).toContain("view skills version");
      const npxCalls = await Bun.file(npxLog).text();
      for (const skillName of allowlist.rootSkills) {
        expect(existsSync(join(home, ".codex", "skills", skillName, "SKILL.md"))).toBe(true);
        expect(existsSync(join(home, ".codex", "skills", skillName, skillName, "SKILL.md"))).toBe(false);
        expect(npxCalls).toContain(join(repoRoot, "skills", skillName));
      }
      for (const legacySkill of pruneLedger.legacySkills) {
        expect(existsSync(join(home, ".codex", "skills", legacySkill))).toBe(false);
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("fails when Claude Code root skill installation fails", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-claude-fail-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-skills-project-"));
    try {
      const { stubBin } = createCliStubs(home, { failNpx: true });
      prepareSyncTaskFixture(fixture);
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      mkdirSync(join(fixture, "skills", "alpha"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill alpha\n");
      writeFileSync(join(fixture, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: Alpha skill.\n---\n");
      copySyncTaskHelpers(fixture);

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
      expect(result.stdout).toContain("failed to sync Claude Code skill: alpha");
      expect(result.stdout).toContain("1 repo-local skill(s) failed to sync to Claude Code");
      expect(result.stdout).toContain("synced skill mirrors: alpha");
      expect(result.stdout).not.toContain("repo-local skill(s) → Claude Code");
      expect(existsSync(join(home, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("prunes stale nested copies when resyncing owned root skills", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-nested-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-skills-project-"));
    try {
      const { stubBin } = createCliStubs(home);
      prepareSyncTaskFixture(fixture);
      mkdirSync(join(home, ".codex", "skills", "alpha", "alpha"), { recursive: true });
      writeFileSync(join(home, ".codex", "skills", "alpha", "alpha", "SKILL.md"), "# stale nested copy\n");
      mkdirSync(join(fixture, "skills", "alpha"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill alpha\n");
      writeFileSync(join(fixture, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: Alpha skill.\n---\n");
      copySyncTaskHelpers(fixture);

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

      expect(existsSync(join(home, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "alpha", "alpha"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("removes stale nested resources from installed Codex root skills", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-stale-resource-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-skills-project-"));
    try {
      const { stubBin } = createCliStubs(home);
      prepareSyncTaskFixture(fixture);
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      mkdirSync(join(fixture, "skills", "alpha", "references"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill alpha\n");
      writeFileSync(join(fixture, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: Alpha skill.\n---\n");
      writeFileSync(join(fixture, "skills", "alpha", "references", "old.md"), "# Old reference\n");
      copySyncTaskHelpers(fixture);

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
      expect(existsSync(join(home, ".codex", "skills", "alpha", "references", "old.md"))).toBe(true);

      rmSync(join(fixture, "skills", "alpha", "references", "old.md"));
      writeFileSync(join(fixture, "skills", "alpha", "references", "new.md"), "# New reference\n");

      const second = runSync();
      if (second.status !== 0) {
        throw new Error(`second sync failed\nstdout:\n${second.stdout}\nstderr:\n${second.stderr}`);
      }

      expect(existsSync(join(home, ".codex", "skills", "alpha", "references", "old.md"))).toBe(false);
      expect(existsSync(join(home, ".codex", "skills", "alpha", "references", "new.md"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("syncs shared skill resources next to installed root skill mirrors", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-shared-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-skills-project-"));
    try {
      const { npxLog, stubBin } = createCliStubs(home);
      prepareSyncTaskFixture(fixture);
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      mkdirSync(join(home, ".claude", "skills"), { recursive: true });
      mkdirSync(join(fixture, "skills", "alpha"), { recursive: true });
      mkdirSync(join(fixture, "skills", "_shared", "references"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill alpha\n");
      writeFileSync(
        join(fixture, "skills", "alpha", "SKILL.md"),
        "---\nname: alpha\ndescription: Alpha skill.\n---\n\nRead `../_shared/references/durable-run.md`.\n",
      );
      writeFileSync(join(fixture, "skills", "_shared", "references", "durable-run.md"), "# Shared\n");
      copySyncTaskHelpers(fixture);

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

      expect(existsSync(join(home, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "_shared", "references", "durable-run.md"))).toBe(true);
      expect(existsSync(join(home, ".claude", "skills", "_shared", "references", "durable-run.md"))).toBe(true);
      expect(readFileSync(npxLog, "utf8")).toContain(join(fixture, "skills", "alpha"));
      expect(readFileSync(npxLog, "utf8")).not.toContain(join(fixture, "skills", "_shared"));
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("fails through the sync path when root skill allowlist drift exists", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-drift-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-skills-project-"));
    try {
      const { stubBin } = createCliStubs(home);
      prepareSyncTaskFixture(fixture);
      mkdirSync(join(fixture, "skills", "listed"), { recursive: true });
      mkdirSync(join(fixture, "skills", "unlisted"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill listed\n");
      writeFileSync(join(fixture, "skills", "listed", "SKILL.md"), "# Listed\n");
      writeFileSync(join(fixture, "skills", "unlisted", "SKILL.md"), "# Unlisted\n");
      copySyncTaskHelpers(fixture);

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
      prepareSyncTaskFixture(fixture);
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      mkdirSync(join(fixture, "skills", "alpha"), { recursive: true });
      mkdirSync(join(fixture, ".claude", "skills", "legacy-local"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill alpha\n");
      writeFileSync(join(fixture, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: Alpha skill.\n---\n");
      writeFileSync(join(fixture, ".claude", "skills", "legacy-local", "SKILL.md"), "---\nname: legacy-local\ndescription: Legacy local skill.\n---\n");
      copySyncTaskHelpers(fixture);

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

  test("prunes explicit legacy artifacts from the separate prune ledger", () => {
    const home = mkdtempSync(join(tmpdir(), "sync-skills-prune-ledger-home-"));
    const fixture = mkdtempSync(join(tmpdir(), "sync-skills-project-"));
    try {
      const { stubBin } = createCliStubs(home);
      prepareSyncTaskFixture(fixture);
      mkdirSync(join(home, ".codex", "skills", "old-skill"), { recursive: true });
      mkdirSync(join(home, ".config", "mimocode", "command"), { recursive: true });
      writeFileSync(join(home, ".config", "mimocode", "command", "old-skill.md"), "");
      mkdirSync(join(fixture, "skills", "alpha"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill alpha\n");
      writeFileSync(join(fixture, "scripts", "default-skill-prune-ledger.txt"), "legacy-skill old-skill\n");
      writeFileSync(join(fixture, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: Alpha skill.\n---\n");
      copySyncTaskHelpers(fixture);

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

      expect(existsSync(join(home, ".codex", "skills", "old-skill"))).toBe(false);
      expect(existsSync(join(home, ".config", "mimocode", "command", "old-skill.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
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
      prepareSyncTaskFixture(fixture);
      mkdirSync(join(home, ".codex", "skills"), { recursive: true });
      mkdirSync(join(fixture, "skills", "alpha"), { recursive: true });
      mkdirSync(join(fixture, "skills", "beta"), { recursive: true });
      writeFileSync(join(fixture, "scripts", "default-skill-allowlist.txt"), "root-skill alpha\nroot-skill beta\n");
      writeFileSync(join(fixture, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: Alpha skill.\n---\n");
      writeFileSync(join(fixture, "skills", "beta", "SKILL.md"), "---\nname: beta\ndescription: Beta skill.\n---\n");
      copySyncTaskHelpers(fixture);

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
      mkdirSync(join(home, ".config", "mimocode", "command"), { recursive: true });
      writeFileSync(join(home, ".config", "mimocode", "command", "beta.md"), "");
      mkdirSync(join(home, ".codex", "skills", "user-skill"), { recursive: true });
      writeFileSync(join(home, ".codex", "skills", "user-skill", "SKILL.md"), "# User skill\n");

      const second = runSync();
      if (second.status !== 0) {
        throw new Error(`second sync failed\nstdout:\n${second.stdout}\nstderr:\n${second.stderr}`);
      }

      expect(existsSync(join(home, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
      expect(existsSync(join(home, ".codex", "skills", "beta"))).toBe(false);
      expect(existsSync(join(home, ".config", "mimocode", "command", "beta.md"))).toBe(true);
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
