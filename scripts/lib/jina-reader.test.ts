import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Attempt = { code: number; status?: string; body?: string };
const reader = join(import.meta.dir, "../../skills/_shared/scripts/jina-reader.sh");

function runReader(attempts: Attempt[], args = ["https://example.com/"]) {
  const fixture = mkdtempSync(join(tmpdir(), "jina-reader-test-"));
  const log = join(fixture, "calls.jsonl");
  writeFileSync(log, "");
  writeFileSync(join(fixture, "attempts.json"), JSON.stringify(attempts));
  writeFileSync(join(fixture, "curl"), `#!/usr/bin/env bun
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const log = process.env.JINA_TEST_LOG;
appendFileSync(log, JSON.stringify(args) + "\\n");
const count = readFileSync(log, "utf8").trim().split("\\n").length;
const attempt = JSON.parse(readFileSync(process.env.JINA_TEST_ATTEMPTS, "utf8"))[count - 1];
if (!attempt) process.exit(99);
if (attempt.body !== undefined) writeFileSync(args[args.indexOf("--output") + 1], attempt.body);
process.stdout.write(attempt.status ?? "000");
process.exit(attempt.code);
`, { mode: 0o755 });
  try {
    const result = Bun.spawnSync(["bash", reader, ...args], {
      env: {
        ...process.env,
        PATH: `${fixture}:${process.env.PATH}`,
        JINA_TEST_LOG: log,
        JINA_TEST_ATTEMPTS: join(fixture, "attempts.json"),
      },
    });
    const calls = readFileSync(log, "utf8").trim();
    return {
      code: result.exitCode,
      stdout: result.stdout.toString(),
      calls: calls ? calls.split("\n").map((line) => JSON.parse(line) as string[]) : [],
    };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe("Jina Reader fallback", () => {
  test("returns one complete fresh read and preserves the source URL", () => {
    const url = "https://example.com/?a=1&items[]=two";
    const result = runReader([{ code: 0, status: "200", body: "document" }], ["--fresh", url]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("document");
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toContain(`https://r.jina.ai/${url}`);
    expect(result.calls[0]).toContain("X-No-Cache: true");
  });

  test("switches resolver after a transport failure without leaking partial content", () => {
    const result = runReader([
      { code: 28, body: "partial" },
      { code: 0, status: "200", body: "complete" },
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("complete");
    expect(result.calls).toHaveLength(2);
    expect(result.calls[0]).toContain("https://dns.google/dns-query");
    expect(result.calls[1]).toContain("https://cloudflare-dns.com/dns-query");
  });

  test("does not switch DNS for an HTTP quota failure", () => {
    const result = runReader([{ code: 22, status: "429", body: "quota error" }]);
    expect(result.code).toBe(22);
    expect(result.stdout).toBe("");
    expect(result.calls).toHaveLength(1);
  });

  test("stops after both transports fail", () => {
    const result = runReader([{ code: 6 }, { code: 7 }]);
    expect(result.code).toBe(7);
    expect(result.stdout).toBe("");
    expect(result.calls).toHaveLength(2);
  });

  test("an empty successful retry cannot expose the previous partial response", () => {
    const result = runReader([{ code: 56, body: "partial" }, { code: 0, status: "204" }]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
  });

  test("rejects a missing URL or non-HTTP input before a network call", () => {
    for (const args of [[], ["file:///etc/hosts"], ["--fresh"]]) {
      const result = runReader([], args);
      expect(result.code).toBe(2);
      expect(result.calls).toHaveLength(0);
    }
  });
});
