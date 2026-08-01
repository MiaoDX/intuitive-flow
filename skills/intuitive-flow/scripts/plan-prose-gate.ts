#!/usr/bin/env bun

import { readFileSync } from "node:fs";

export type FindingKind =
  | "long_sentence"
  | "semicolon"
  | "contraction"
  | "passive_voice"
  | "formal_word"
  | "marketing_word";

export type ProseFinding = {
  kind: FindingKind;
  line: number;
  section: string;
  protected: boolean;
  text: string;
};

export type ProseLintResult = {
  mode: "shadow";
  words: number;
  findings: ProseFinding[];
  findingCount: number;
  rewriteEligibleFindingCount: number;
  protectedFindingCount: number;
  scorePer100Words: number;
};

export type PlanInvariantResult = {
  ok: boolean;
  changed: string[];
};

const PROTECTED_SECTIONS = new Set([
  "plan ledger",
  "scope",
  "accepted contract",
  "non-goals",
  "decisions already made",
  "idea shaping decisions",
  "acceptance criteria",
  "verification",
  "stop gates",
  "preflight",
  "execution contract",
  "gsd handoff trigger",
]);

const FORMAL_WORDS = [
  "additionally",
  "commence",
  "demonstrate",
  "facilitate",
  "furthermore",
  "in order to",
  "initiate",
  "it is important to note",
  "leverage",
  "moreover",
  "obtain",
  "prior to",
  "subsequent to",
  "utilize",
];

const MARKETING_WORDS = [
  "best-in-class",
  "cutting-edge",
  "effortless",
  "enterprise-grade",
  "game-changing",
  "next-generation",
  "powerful",
  "revolutionary",
  "robust",
  "seamless",
  "state-of-the-art",
  "world-class",
];

type FenceState = {
  character: "`" | "~";
  length: number;
};

const fenceToken = (line: string): string | undefined =>
  line.match(/^\s*(`{3,}|~{3,})/)?.[1];

const nextFenceState = (state: FenceState | undefined, line: string): FenceState | undefined => {
  const token = fenceToken(line);
  if (!token) return state;
  const character = token[0] as "`" | "~";
  if (!state) return { character, length: token.length };
  if (state.character === character && token.length >= state.length) return undefined;
  return state;
};

const normalizeSection = (value: string): string =>
  value
    .replace(/[`*_]/g, "")
    .trim()
    .toLowerCase();

const isProtectedSection = (section: string): boolean => {
  const normalized = normalizeSection(section);
  return PROTECTED_SECTIONS.has(normalized) || normalized.startsWith("preflight ");
};

const stripMarkdown = (line: string): string =>
  line
    .replace(/^\s*(?:[-*+] |\d+[.)] |>|\[[ xX]\]\s*)+/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`[^`]*`/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const wordCount = (value: string): number =>
  value.match(/[A-Za-z0-9][A-Za-z0-9'/-]*/g)?.length ?? 0;

const sentences = (value: string): string[] =>
  value
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const phraseCount = (value: string, phrase: string): number => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...value.matchAll(new RegExp(`(?<![a-z])${escaped}(?![a-z])`, "gi"))].length;
};

const addFinding = (
  findings: ProseFinding[],
  kind: FindingKind,
  line: number,
  section: string,
  text: string,
  count = 1,
) => {
  for (let index = 0; index < count; index += 1) {
    findings.push({
      kind,
      line,
      section,
      protected: isProtectedSection(section),
      text,
    });
  }
};

export const lintPlanProse = (markdown: string): ProseLintResult => {
  const findings: ProseFinding[] = [];
  let section = "document";
  let fence: FenceState | undefined;
  let words = 0;

  markdown.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    if (fenceToken(rawLine)) {
      fence = nextFenceState(fence, rawLine);
      return;
    }
    if (fence || /^\s*\|/.test(rawLine) || /^\s*<!--/.test(rawLine)) {
      return;
    }

    const heading = rawLine.match(/^#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      section = heading[1] ?? "document";
      return;
    }

    const prose = stripMarkdown(rawLine);
    if (prose === "" || /^[-=:]+$/.test(prose)) {
      return;
    }

    words += wordCount(prose);
    for (const sentence of sentences(prose)) {
      if (wordCount(sentence) > 25) {
        addFinding(findings, "long_sentence", lineNumber, section, sentence);
      }
    }

    addFinding(findings, "semicolon", lineNumber, section, prose, (prose.match(/;/g) ?? []).length);
    addFinding(
      findings,
      "contraction",
      lineNumber,
      section,
      prose,
      (prose.match(/\b[A-Za-z]+['’](?:t|re|ve|ll|d|s|m)\b/g) ?? []).length,
    );
    addFinding(
      findings,
      "passive_voice",
      lineNumber,
      section,
      prose,
      (prose.match(/\b(?:am|is|are|was|were|be|been|being)\s+(?:[A-Za-z]+ed|done|made|sent|built|kept|written|shown|given|found)\b/gi) ?? []).length,
    );

    for (const phrase of FORMAL_WORDS) {
      addFinding(findings, "formal_word", lineNumber, section, prose, phraseCount(prose, phrase));
    }
    for (const phrase of MARKETING_WORDS) {
      addFinding(findings, "marketing_word", lineNumber, section, prose, phraseCount(prose, phrase));
    }
  });

  const protectedFindingCount = findings.filter((finding) => finding.protected).length;
  return {
    mode: "shadow",
    words,
    findings,
    findingCount: findings.length,
    rewriteEligibleFindingCount: findings.length - protectedFindingCount,
    protectedFindingCount,
    scorePer100Words: words === 0 ? 0 : Number(((findings.length * 100) / words).toFixed(2)),
  };
};

const fencedCode = (markdown: string): string[] => {
  const blocks: string[] = [];
  let fence: FenceState | undefined;
  let current: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!fence && fenceToken(line)) {
      fence = nextFenceState(undefined, line);
      current = [line];
      continue;
    }
    if (fence) {
      current.push(line);
      const next = nextFenceState(fence, line);
      if (!next) {
        blocks.push(current.join("\n"));
        current = [];
      }
      fence = next;
    }
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks;
};

const markdownWithoutFences = (markdown: string): string => {
  const outside: string[] = [];
  let fence: FenceState | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    if (fenceToken(line)) {
      fence = nextFenceState(fence, line);
      continue;
    }
    if (!fence) outside.push(line);
  }
  return outside.join("\n");
};

const inlineLiterals = (markdown: string): string[] =>
  [...markdownWithoutFences(markdown).matchAll(/`[^`\n]+`/g)].map((match) => match[0]);

const urls = (markdown: string): string[] =>
  [...markdownWithoutFences(markdown).matchAll(/https?:\/\/[^\s)>]+/g)].map((match) => match[0]);

const tables = (markdown: string): string[] =>
  markdown.split(/\r?\n/).filter((line) => /^\s*\|/.test(line));

const paths = (markdown: string): string[] =>
  [...markdownWithoutFences(markdown).matchAll(/(?:\.{0,2}\/)?(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+/g)]
    .map((match) => match[0])
    .filter((value) => !value.startsWith("http"));

const codeIdentifiers = (markdown: string): string[] =>
  [...markdownWithoutFences(markdown).matchAll(/\b(?:[A-Za-z]+_[A-Za-z0-9_]+|[a-z]+[A-Z][A-Za-z0-9]*)\b/g)]
    .map((match) => match[0]);

const numericLiterals = (markdown: string): string[] =>
  [...markdownWithoutFences(markdown).matchAll(/\b\d+(?:\.\d+)*(?:%|ms|s|m|h|KB|MB|GB)?\b/g)]
    .map((match) => match[0]);

const headings = (markdown: string): string[] =>
  [...markdownWithoutFences(markdown).matchAll(/^#{1,6}\s+.+$/gm)].map((match) => match[0].trimEnd());

const protectedSectionText = (markdown: string): string[] => {
  const lines = markdown.split(/\r?\n/);
  const sections: string[] = [];
  let current: string[] | undefined;
  let protectedLevel: number | undefined;
  let fence: FenceState | undefined;

  for (const line of lines) {
    if (fenceToken(line)) {
      current?.push(line);
      fence = nextFenceState(fence, line);
      continue;
    }
    if (fence) {
      current?.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      const level = heading[1]?.length ?? 0;
      if (current && protectedLevel !== undefined && level <= protectedLevel) {
        sections.push(current.join("\n"));
        current = undefined;
        protectedLevel = undefined;
      }
      if (!current && isProtectedSection(heading[2] ?? "")) {
        current = [line];
        protectedLevel = level;
        continue;
      }
    }
    current?.push(line);
  }
  if (current) sections.push(current.join("\n"));
  return sections;
};

const same = (left: string[], right: string[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const comparePlanInvariants = (before: string, candidate: string): PlanInvariantResult => {
  const changed: string[] = [];
  if (!same(headings(before), headings(candidate))) changed.push("headings");
  if (!same(fencedCode(before), fencedCode(candidate))) changed.push("fenced code");
  if (!same(inlineLiterals(before), inlineLiterals(candidate))) changed.push("inline literals");
  if (!same(urls(before), urls(candidate))) changed.push("URLs");
  if (!same(tables(before), tables(candidate))) changed.push("tables");
  if (!same(paths(before), paths(candidate))) changed.push("paths");
  if (!same(codeIdentifiers(before), codeIdentifiers(candidate))) changed.push("identifiers");
  if (!same(numericLiterals(before), numericLiterals(candidate))) changed.push("numeric literals");
  if (!same(protectedSectionText(before), protectedSectionText(candidate))) changed.push("protected sections");
  return { ok: changed.length === 0, changed };
};

const usage = () => {
  console.error("Usage: plan-prose-gate.ts [--json] <plan.md>");
  console.error("       plan-prose-gate.ts [--json] --compare <before.md> <candidate.md>");
};

const main = () => {
  const args = process.argv.slice(2);
  const json = args[0] === "--json";
  const values = json ? args.slice(1) : args;

  if (values[0] === "--compare") {
    if (values.length !== 3) {
      usage();
      process.exit(2);
    }
    const before = readFileSync(values[1]!, "utf8");
    const candidate = readFileSync(values[2]!, "utf8");
    const baseline = lintPlanProse(before);
    const revised = lintPlanProse(candidate);
    const invariants = comparePlanInvariants(before, candidate);
    if (json) {
      console.log(JSON.stringify({ baseline, candidate: revised, invariants }, null, 2));
    } else {
      console.log(
        `Plan prose compare: score=${baseline.scorePer100Words}->${revised.scorePer100Words}; ` +
          `invariants=${invariants.ok ? "pass" : `fail (${invariants.changed.join(", ")})`}.`,
      );
    }
    process.exit(invariants.ok ? 0 : 1);
  }

  if (values.length !== 1) {
    usage();
    process.exit(2);
  }

  const result = lintPlanProse(readFileSync(values[0]!, "utf8"));
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `Plan prose gate: checked (shadow); findings=${result.findingCount}; ` +
        `eligible=${result.rewriteEligibleFindingCount}; protected=${result.protectedFindingCount}; ` +
        `score=${result.scorePer100Words}; rewrite=not-run.`,
    );
  }
};

if (import.meta.main) {
  main();
}
