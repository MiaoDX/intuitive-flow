import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const scriptPath = join(process.cwd(), "skills", "intuitive-reduce-entropy", "scripts", "high-noise-summary.mjs");
const commandSummaryPath = join(
  process.cwd(),
  "skills",
  "intuitive-reduce-entropy",
  "scripts",
  "bounded-command-summary.mjs",
);

const git = (cwd: string, args: string[]) =>
  spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

describe("reduce entropy high-noise summary", () => {
  test("summarizes high-noise surfaces without printing long file lists", () => {
    const cwd = mkdtempSync(join(tmpdir(), "high-noise-summary-"));
    git(cwd, ["init"]);
    git(cwd, ["config", "user.email", "test@example.com"]);
    git(cwd, ["config", "user.name", "Test"]);

    mkdirSync(join(cwd, ".planning", "phases"), { recursive: true });
    for (let index = 0; index < 30; index += 1) {
      writeFileSync(join(cwd, ".planning", "phases", `${String(index).padStart(2, "0")}-PLAN.md`), "# Plan\n");
    }
    writeFileSync(join(cwd, "README.md"), "See .planning for execution state.\n");
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-m", "fixture"]);

    const result = spawnSync("node", [scriptPath, "--surface", ".planning", "--examples", "3"], {
      cwd,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("tracked=30");
    expect(result.stdout).toContain("reference_samples=1");
    expect(result.stdout).toContain("00-PLAN.md");
    expect(result.stdout).not.toContain("20-PLAN.md");
  });

  test("includes discovered profile registries in the default summary", () => {
    const cwd = mkdtempSync(join(tmpdir(), "high-noise-summary-profiles-"));
    git(cwd, ["init"]);
    git(cwd, ["config", "user.email", "test@example.com"]);
    git(cwd, ["config", "user.name", "Test"]);

    mkdirSync(join(cwd, "pkg", "profiles"), { recursive: true });
    writeFileSync(join(cwd, "pkg", "profiles", "g1.py"), "PROFILES = []\n");
    writeFileSync(join(cwd, "README.md"), "Profile docs mention pkg/profiles.\n");
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-m", "fixture"]);

    const result = spawnSync("node", [scriptPath, "--examples", "3"], {
      cwd,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("## pkg/profiles");
    expect(result.stdout).toContain("tracked=1");
  });

  test("keeps default summary samples and long reference lines bounded", () => {
    const cwd = mkdtempSync(join(tmpdir(), "high-noise-summary-bounds-"));
    git(cwd, ["init"]);
    git(cwd, ["config", "user.email", "test@example.com"]);
    git(cwd, ["config", "user.name", "Test"]);

    mkdirSync(join(cwd, ".planning"), { recursive: true });
    for (let index = 0; index < 12; index += 1) {
      writeFileSync(join(cwd, ".planning", `${String(index).padStart(2, "0")}-PLAN.md`), "# Plan\n");
    }
    writeFileSync(join(cwd, "README.md"), `See .planning ${"x".repeat(260)}\n`);
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-m", "fixture"]);

    const result = spawnSync("node", [scriptPath], {
      cwd,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Examples per list: 6");
    expect(result.stdout).toContain("05-PLAN.md");
    expect(result.stdout).not.toContain("06-PLAN.md");
    expect(result.stdout).toContain("…");
    expect(result.stdout).not.toContain("x".repeat(240));
  });
});

describe("reduce entropy bounded command summary", () => {
  test("keeps generic command output bounded while preserving the full log", () => {
    const result = spawnSync(
      "node",
      [
        commandSummaryPath,
        "--kind",
        "generic",
        "--max-matches",
        "2",
        "--tail",
        "3",
        "--",
        "node",
        "-e",
        [
          "for (let index = 0; index < 20; index += 1) console.log(`noise-${index}`);",
          "console.error('ERROR first');",
          "console.error('Traceback second');",
          "console.log('done');",
        ].join(" "),
      ],
      {
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("# Bounded Command Summary");
    expect(result.stdout).toContain("status: 0");
    expect(result.stdout).toContain("ERROR first");
    expect(result.stdout).toContain("Traceback second");
    expect(result.stdout).not.toContain("noise-0");
    expect(result.stdout).toContain("done");

    const logPath = result.stdout.match(/^log: (.+)$/m)?.[1];
    expect(logPath).toBeTruthy();
    expect(existsSync(logPath!)).toBe(true);
    expect(readFileSync(logPath!, "utf8")).toContain("noise-0");
    expect(readFileSync(logPath!, "utf8")).toContain("noise-19");
  });

  test("omits pytest collect tails so collected node ids do not flood output", () => {
    const result = spawnSync(
      "node",
      [
        commandSummaryPath,
        "--kind",
        "pytest-collect",
        "--",
        "node",
        "-e",
        [
          "for (let index = 0; index < 50; index += 1) console.log(`tests/example_test.py::test_case_${index}`);",
          "console.error('ERROR collecting tests/example_test.py');",
          "console.error('ImportError: missing dependency');",
          "console.log('50 tests collected');",
        ].join(" "),
      ],
      {
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("status: 0");
    expect(result.stdout).toContain("ERROR collecting tests/example_test.py");
    expect(result.stdout).toContain("ImportError: missing dependency");
    expect(result.stdout).toContain("50 tests collected");
    expect(result.stdout).toContain("omitted for pytest-collect");
    expect(result.stdout).not.toContain("tests/example_test.py::test_case_0");
    expect(result.stdout).not.toContain("tests/example_test.py::test_case_49");
  });
});
