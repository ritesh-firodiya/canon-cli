import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export interface VerdictEntry {
  product: string;
  at: string;
  verdict: string;
  principles: string[];
  request: string;
  reason: string;
}

export interface Decision {
  id: string;
  decision: "approved" | "rejected";
  /** How many overrides the proposal had when it was decided. */
  count: number;
  at: string;
  note: string;
}

export interface Proposal {
  id: string;
  summary: string;
  count: number;
  products: string[];
  reasons: string[];
}

const LOG = join(".context", "raw", "zeno", "verdicts.jsonl");
const MAX_REASONS = 5;

function readJsonLines<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .flatMap((line) => {
      try {
        return line.trim() ? [JSON.parse(line) as T] : [];
      } catch {
        return [];
      }
    });
}

export function readVerdicts(repos: string[]): VerdictEntry[] {
  return repos.flatMap((repo) =>
    readJsonLines<Omit<VerdictEntry, "product">>(join(repo, LOG)).map((entry) => ({ ...entry, product: basename(repo) })),
  );
}

function group(entries: VerdictEntry[], keyOf: (entry: VerdictEntry) => string[]): Map<string, VerdictEntry[]> {
  const groups = new Map<string, VerdictEntry[]>();
  for (const entry of entries) {
    for (const key of keyOf(entry)) groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return groups;
}

function toProposal(id: string, summary: string, entries: VerdictEntry[]): Proposal {
  return {
    id,
    summary,
    count: entries.length,
    products: [...new Set(entries.map((e) => e.product))].sort(),
    reasons: [...new Set(entries.map((e) => e.reason))].slice(0, MAX_REASONS),
  };
}

/**
 * Turns override history into proposals: a principle overridden `threshold`+
 * times, or one reason given in two or more products. A decided proposal comes
 * back only when its count has grown past what it was when decided.
 */
export function proposals(entries: VerdictEntry[], options: { threshold: number; decisions: Decision[] }): Proposal[] {
  const found: Proposal[] = [];
  for (const [principle, group_] of group(entries, (e) => e.principles)) {
    if (group_.length >= options.threshold) {
      found.push(toProposal(`principle:${principle}`, `${principle} was overridden ${group_.length} times — revisit the rule or its wording`, group_));
    }
  }
  for (const [reason, group_] of group(entries, (e) => [e.reason])) {
    const products = new Set(group_.map((e) => e.product));
    if (products.size >= 2) {
      found.push(toProposal(`reason:${reason}`, `"${reason}" was given in ${products.size} products — a missing exception?`, group_));
    }
  }
  const decidedAt = new Map(options.decisions.map((d) => [d.id, d.count]));
  return found.filter((p) => !decidedAt.has(p.id) || p.count > (decidedAt.get(p.id) ?? 0));
}

const DECISIONS = join("learn", "decisions.jsonl");

export function readDecisions(zenoRoot: string): Decision[] {
  return readJsonLines<Decision>(join(zenoRoot, DECISIONS));
}

export function recordDecision(zenoRoot: string, decision: Omit<Decision, "at">): void {
  mkdirSync(join(zenoRoot, "learn"), { recursive: true });
  appendFileSync(join(zenoRoot, DECISIONS), `${JSON.stringify({ ...decision, at: new Date().toISOString() })}\n`);
}
