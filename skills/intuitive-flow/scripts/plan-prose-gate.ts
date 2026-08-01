#!/usr/bin/env bun

import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

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

export type TrialVerdict = "useful" | "mixed" | "noise";

export type ShadowCheckEvent = {
  schemaVersion: 1;
  type: "check";
  eventId: string;
  timestamp: string;
  adapter: "ste-flavored-v1";
  mode: "shadow";
  repoRoot: string;
  repoName: string;
  planPath: string;
  contentHash: string;
  result: Omit<ProseLintResult, "findings"> & {
    findingsByKind: Record<FindingKind, number>;
  };
};

export type TrialReviewEvent = {
  schemaVersion: 1;
  type: "review";
  eventId: string;
  timestamp: string;
  targetEventId: string;
  verdict: TrialVerdict;
  note?: string;
};

export type TrialEvent = ShadowCheckEvent | TrialReviewEvent;

export type TrialReport = {
  since: string;
  checkCount: number;
  uniquePlanCount: number;
  uniqueSnapshotCount: number;
  reviewedSnapshotCount: number;
  averageScore: number;
  totalFindings: number;
  eligibleFindings: number;
  protectedFindings: number;
  findingsByKind: Record<FindingKind, number>;
  verdicts: Record<TrialVerdict | "unreviewed", number>;
  recommendation:
    | "COLLECT_MORE_SNAPSHOTS"
    | "REVIEW_SAMPLES"
    | "DROP_OR_RETUNE"
    | "ADVANCE_TO_CANDIDATE_SHADOW"
    | "KEEP_SHADOW";
  samples: Array<{
    eventId: string;
    repoName: string;
    planPath: string;
    score: number;
    findings: number;
    eligible: number;
    protected: number;
    verdict: TrialVerdict | "unreviewed";
  }>;
  malformedLineCount: number;
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

const FINDING_KINDS: FindingKind[] = [
  "long_sentence",
  "semicolon",
  "contraction",
  "passive_voice",
  "formal_word",
  "marketing_word",
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

const emptyFindingCounts = (): Record<FindingKind, number> => ({
  long_sentence: 0,
  semicolon: 0,
  contraction: 0,
  passive_voice: 0,
  formal_word: 0,
  marketing_word: 0,
});

const findingCounts = (findings: ProseFinding[]): Record<FindingKind, number> => {
  const counts = emptyFindingCounts();
  for (const finding of findings) counts[finding.kind] += 1;
  return counts;
};

const findRepoRoot = (start: string): string => {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
};

export const defaultTrialStateFile = (
  env: Record<string, string | undefined> = process.env,
  home = homedir(),
): string => {
  const stateRoot = env.XDG_STATE_HOME?.trim() || join(home, ".local", "state");
  return join(stateRoot, "intuitive-flow", "plan-prose-gate.jsonl");
};

const appendTrialEvent = (stateFile: string, event: TrialEvent) => {
  const stateDir = dirname(stateFile);
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  chmodSync(stateDir, 0o700);
  appendFileSync(stateFile, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(stateFile, 0o600);
};

export const recordShadowCheck = (
  planFile: string,
  markdown: string,
  result: ProseLintResult,
  stateFile = defaultTrialStateFile(),
  now = new Date(),
): ShadowCheckEvent => {
  const absolutePlan = resolve(planFile);
  const repoRoot = findRepoRoot(dirname(absolutePlan));
  const event: ShadowCheckEvent = {
    schemaVersion: 1,
    type: "check",
    eventId: randomUUID(),
    timestamp: now.toISOString(),
    adapter: "ste-flavored-v1",
    mode: "shadow",
    repoRoot,
    repoName: basename(repoRoot),
    planPath: relative(repoRoot, absolutePlan) || basename(absolutePlan),
    contentHash: createHash("sha256").update(markdown).digest("hex"),
    result: {
      mode: result.mode,
      words: result.words,
      findingCount: result.findingCount,
      rewriteEligibleFindingCount: result.rewriteEligibleFindingCount,
      protectedFindingCount: result.protectedFindingCount,
      scorePer100Words: result.scorePer100Words,
      findingsByKind: findingCounts(result.findings),
    },
  };
  appendTrialEvent(stateFile, event);
  return event;
};

export const readTrialEvents = (stateFile = defaultTrialStateFile()): {
  events: TrialEvent[];
  malformedLineCount: number;
} => {
  if (!existsSync(stateFile)) return { events: [], malformedLineCount: 0 };
  const events: TrialEvent[] = [];
  let malformedLineCount = 0;
  for (const line of readFileSync(stateFile, "utf8").split(/\r?\n/)) {
    if (line.trim() === "") continue;
    try {
      const event = JSON.parse(line) as Partial<TrialEvent>;
      const result = event.type === "check" ? event.result : undefined;
      const findingKindCountsValid = result && typeof result.findingsByKind === "object" &&
        FINDING_KINDS.every((kind) => {
          const count = result.findingsByKind[kind];
          return typeof count === "number" && Number.isInteger(count) && count >= 0;
        });
      const resultValid = result && result.mode === "shadow" &&
        typeof result.words === "number" && Number.isInteger(result.words) && result.words >= 0 &&
        typeof result.findingCount === "number" && Number.isInteger(result.findingCount) && result.findingCount >= 0 &&
        typeof result.rewriteEligibleFindingCount === "number" && Number.isInteger(result.rewriteEligibleFindingCount) &&
        result.rewriteEligibleFindingCount >= 0 &&
        typeof result.protectedFindingCount === "number" && Number.isInteger(result.protectedFindingCount) &&
        result.protectedFindingCount >= 0 &&
        typeof result.scorePer100Words === "number" && Number.isFinite(result.scorePer100Words) &&
        findingKindCountsValid;
      const commonValid = event.schemaVersion === 1 && typeof event.eventId === "string" &&
        typeof event.timestamp === "string" && Number.isFinite(Date.parse(event.timestamp));
      const checkValid = event.type === "check" && typeof event.contentHash === "string" &&
        typeof event.repoRoot === "string" && typeof event.planPath === "string" &&
        typeof event.repoName === "string" && event.adapter === "ste-flavored-v1" &&
        event.mode === "shadow" && resultValid;
      const reviewValid = event.type === "review" && typeof event.targetEventId === "string" &&
        (event.verdict === "useful" || event.verdict === "mixed" || event.verdict === "noise") &&
        (event.note === undefined || typeof event.note === "string");
      if (!commonValid || (!checkValid && !reviewValid)) {
        malformedLineCount += 1;
      } else {
        events.push(event as TrialEvent);
      }
    } catch {
      malformedLineCount += 1;
    }
  }
  return { events, malformedLineCount };
};

export const recordTrialReview = (
  targetEventId: string,
  verdict: TrialVerdict,
  note: string | undefined,
  stateFile = defaultTrialStateFile(),
  now = new Date(),
): TrialReviewEvent => {
  const { events } = readTrialEvents(stateFile);
  if (!events.some((event) => event.type === "check" && event.eventId === targetEventId)) {
    throw new Error(`unknown check event: ${targetEventId}`);
  }
  const cleanNote = note?.trim().replace(/\s+/g, " ").slice(0, 500);
  const event: TrialReviewEvent = {
    schemaVersion: 1,
    type: "review",
    eventId: randomUUID(),
    timestamp: now.toISOString(),
    targetEventId,
    verdict,
    ...(cleanNote ? { note: cleanNote } : {}),
  };
  appendTrialEvent(stateFile, event);
  return event;
};

export const parseDurationMs = (value: string): number => {
  const match = value.match(/^(\d+)([dhm])$/);
  if (!match) throw new Error(`invalid duration: ${value}; use forms such as 7d, 12h, or 30m`);
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "d" ? 86_400_000 : unit === "h" ? 3_600_000 : 60_000;
  return amount * multiplier;
};

const snapshotKey = (event: ShadowCheckEvent): string =>
  `${event.repoRoot}\0${event.planPath}\0${event.contentHash}`;

export const buildTrialReport = (
  events: TrialEvent[],
  since: Date,
  malformedLineCount = 0,
): TrialReport => {
  const checks = events.filter(
    (event): event is ShadowCheckEvent => event.type === "check" && new Date(event.timestamp) >= since,
  );
  const eventById = new Map(
    events.filter((event): event is ShadowCheckEvent => event.type === "check").map((event) => [event.eventId, event]),
  );
  const latestSnapshot = new Map<string, ShadowCheckEvent>();
  for (const check of checks) latestSnapshot.set(snapshotKey(check), check);
  const snapshots = [...latestSnapshot.values()];
  const snapshotVerdicts = new Map<string, TrialReviewEvent>();
  for (const event of events) {
    if (event.type !== "review") continue;
    const target = eventById.get(event.targetEventId);
    if (!target) continue;
    const key = snapshotKey(target);
    const previous = snapshotVerdicts.get(key);
    if (!previous || previous.timestamp < event.timestamp) snapshotVerdicts.set(key, event);
  }

  const findingsByKind = emptyFindingCounts();
  let totalFindings = 0;
  let eligibleFindings = 0;
  let protectedFindings = 0;
  let totalScore = 0;
  const verdicts: TrialReport["verdicts"] = { useful: 0, mixed: 0, noise: 0, unreviewed: 0 };
  for (const snapshot of snapshots) {
    totalFindings += snapshot.result.findingCount;
    eligibleFindings += snapshot.result.rewriteEligibleFindingCount;
    protectedFindings += snapshot.result.protectedFindingCount;
    totalScore += snapshot.result.scorePer100Words;
    for (const kind of FINDING_KINDS) findingsByKind[kind] += snapshot.result.findingsByKind[kind] ?? 0;
    const review = snapshotVerdicts.get(snapshotKey(snapshot));
    verdicts[review?.verdict ?? "unreviewed"] += 1;
  }

  const uniquePlanCount = new Set(snapshots.map((event) => `${event.repoRoot}\0${event.planPath}`)).size;
  const reviewedSnapshotCount = snapshots.length - verdicts.unreviewed;
  const requiredReviews = Math.min(5, snapshots.length);
  let recommendation: TrialReport["recommendation"] = "KEEP_SHADOW";
  if (snapshots.length < 5) {
    recommendation = "COLLECT_MORE_SNAPSHOTS";
  } else if (reviewedSnapshotCount < requiredReviews) {
    recommendation = "REVIEW_SAMPLES";
  } else if (verdicts.noise / reviewedSnapshotCount >= 0.5) {
    recommendation = "DROP_OR_RETUNE";
  } else if (verdicts.useful / reviewedSnapshotCount >= 0.6) {
    recommendation = "ADVANCE_TO_CANDIDATE_SHADOW";
  }

  const samples = snapshots
    .sort((left, right) => right.result.scorePer100Words - left.result.scorePer100Words)
    .slice(0, 10)
    .map((event) => {
      const verdict: TrialVerdict | "unreviewed" =
        snapshotVerdicts.get(snapshotKey(event))?.verdict ?? "unreviewed";
      return {
        eventId: event.eventId,
        repoName: event.repoName,
        planPath: event.planPath,
        score: event.result.scorePer100Words,
        findings: event.result.findingCount,
        eligible: event.result.rewriteEligibleFindingCount,
        protected: event.result.protectedFindingCount,
        verdict,
      };
    });

  return {
    since: since.toISOString(),
    checkCount: checks.length,
    uniquePlanCount,
    uniqueSnapshotCount: snapshots.length,
    reviewedSnapshotCount,
    averageScore: snapshots.length === 0 ? 0 : Number((totalScore / snapshots.length).toFixed(2)),
    totalFindings,
    eligibleFindings,
    protectedFindings,
    findingsByKind,
    verdicts,
    recommendation,
    samples,
    malformedLineCount,
  };
};

const formatTrialReport = (report: TrialReport): string => {
  const kinds = FINDING_KINDS.map((kind) => `${kind}=${report.findingsByKind[kind]}`).join(", ");
  const samples = report.samples.length === 0
    ? "- none"
    : report.samples.map((sample) =>
      `- ${sample.eventId} ${sample.repoName}/${sample.planPath} score=${sample.score} ` +
      `findings=${sample.findings} eligible=${sample.eligible} protected=${sample.protected} verdict=${sample.verdict}`,
    ).join("\n");
  return [
    `Plan prose trial report since ${report.since}`,
    `checks=${report.checkCount}; unique_plans=${report.uniquePlanCount}; unique_snapshots=${report.uniqueSnapshotCount}; reviewed=${report.reviewedSnapshotCount}.`,
    `average_score=${report.averageScore}; findings=${report.totalFindings}; eligible=${report.eligibleFindings}; protected=${report.protectedFindings}.`,
    `verdicts: useful=${report.verdicts.useful}; mixed=${report.verdicts.mixed}; noise=${report.verdicts.noise}; unreviewed=${report.verdicts.unreviewed}.`,
    `finding kinds: ${kinds}.`,
    `recommendation=${report.recommendation}; malformed_lines=${report.malformedLineCount}.`,
    "Review samples:",
    samples,
  ].join("\n");
};

const usage = () => {
  console.error("Usage: plan-prose-gate.ts [--json] [--no-record] [--state-file <path>] <plan.md>");
  console.error("       plan-prose-gate.ts [--json] --compare <before.md> <candidate.md>");
  console.error("       plan-prose-gate.ts [--json] [--state-file <path>] --report [--since 7d]");
  console.error("       plan-prose-gate.ts [--state-file <path>] --review <event-id> <useful|mixed|noise> [note]");
};

const main = () => {
  const args = process.argv.slice(2);
  let json = false;
  let noRecord = false;
  let stateFile = defaultTrialStateFile();
  let sinceValue = "7d";
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--json") {
      json = true;
    } else if (arg === "--no-record") {
      noRecord = true;
    } else if (arg === "--state-file") {
      const value = args[index + 1];
      if (!value) throw new Error("--state-file requires a path");
      stateFile = resolve(value);
      index += 1;
    } else if (arg === "--since") {
      const value = args[index + 1];
      if (!value) throw new Error("--since requires a duration");
      sinceValue = value;
      index += 1;
    } else {
      values.push(arg);
    }
  }

  if (values[0] === "--report") {
    if (values.length !== 1) {
      usage();
      process.exit(2);
    }
    const { events, malformedLineCount } = readTrialEvents(stateFile);
    const since = new Date(Date.now() - parseDurationMs(sinceValue));
    const report = buildTrialReport(events, since, malformedLineCount);
    console.log(json ? JSON.stringify(report, null, 2) : formatTrialReport(report));
    return;
  }

  if (values[0] === "--review") {
    const targetEventId = values[1];
    const verdict = values[2] as TrialVerdict | undefined;
    if (!targetEventId || !verdict || !["useful", "mixed", "noise"].includes(verdict)) {
      usage();
      process.exit(2);
    }
    const review = recordTrialReview(targetEventId, verdict, values.slice(3).join(" ") || undefined, stateFile);
    console.log(`Plan prose trial review: event=${review.targetEventId}; verdict=${review.verdict}; recorded=${stateFile}.`);
    return;
  }

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

  const planFile = values[0]!;
  const markdown = readFileSync(planFile, "utf8");
  const result = lintPlanProse(markdown);
  let record: ShadowCheckEvent | undefined;
  let recordError: string | undefined;
  if (!noRecord) {
    try {
      record = recordShadowCheck(planFile, markdown, result, stateFile);
    } catch (error) {
      recordError = error instanceof Error ? error.message : String(error);
    }
  }
  if (json) {
    console.log(JSON.stringify({ result, record, recordError, stateFile: noRecord ? undefined : stateFile }, null, 2));
  } else {
    const recordStatus = noRecord
      ? "disabled"
      : record
        ? `${record.eventId} -> ${stateFile}`
        : `failed (${recordError})`;
    console.log(
      `Plan prose gate: checked (shadow); findings=${result.findingCount}; ` +
        `eligible=${result.rewriteEligibleFindingCount}; protected=${result.protectedFindingCount}; ` +
        `score=${result.scorePer100Words}; rewrite=not-run; record=${recordStatus}.`,
    );
  }
};

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(`plan-prose-gate: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}
