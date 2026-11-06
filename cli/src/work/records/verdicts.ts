import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { Config } from "../../config/schema.ts";
import { allRecords, appendToSection, createRecord, findRecord, kindByFolder } from "./records.ts";

export const VERDICTS = ["do-it", "do-it-differently", "push-back"] as const;
export const OUTCOMES = ["proceeded", "stopped", "overridden", "dropped"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const SIZES = ["small", "medium", "large", "too-large"] as const;

export interface Claims {
  backed: number;
  total: number;
}

export interface Verdict {
  at: string;
  verdict: string;
  outcome: Outcome;
  principles: string[];
  request: string;
  reason: string;
  terms: string[];
  size?: string;
  claims?: Claims;
}

const SEP = " · ";

export function formatVerdict(verdict: Verdict): string {
  const line = `- ${verdict.at.slice(0, 10)}${SEP}${verdict.verdict}${SEP}${verdict.outcome}${SEP}${verdict.principles.join(", ") || "none"}${SEP}${verdict.request.replace(/\s+/g, " ")}`;
  const details = [
    ...(verdict.size ? [`  - Size: ${verdict.size}`] : []),
    ...(verdict.claims ? [`  - Claims: ${verdict.claims.backed}/${verdict.claims.total} backed`] : []),
    ...(verdict.reason ? [`  - Reason: ${verdict.reason.replace(/\s+/g, " ")}`] : []),
    ...verdict.terms.map((term) => `  - Term: ${term.replace(/\s+/g, " ")}`),
  ];
  return [line, ...details].join("\n");
}

const LINE = /^- (\d{4}-\d{2}-\d{2}) · ([a-z-]+) · ([a-z]+) · ([^·]+) · (.*)$/;
const CLAIMS = /^ {2}- Claims: (\d+)\/(\d+) backed$/;

export function parseVerdicts(text: string): Verdict[] {
  const section = /^## Verdict[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1] ?? "";
  const verdicts: Verdict[] = [];
  for (const raw of section.split("\n")) {
    const match = LINE.exec(raw);
    const last = verdicts[verdicts.length - 1];
    if (match) {
      const [, at, verdict, outcome, principles, request] = match;
      verdicts.push({ at, verdict, outcome: outcome as Outcome, principles: principles === "none" ? [] : principles.split(", "), request, reason: "", terms: [] });
      continue;
    }
    const claims = CLAIMS.exec(raw);
    if (last && claims) last.claims = { backed: Number(claims[1]), total: Number(claims[2]) };
    else if (last && raw.startsWith("  - Size: ")) last.size = raw.slice(10);
    else if (last && raw.startsWith("  - Reason: ")) last.reason = raw.slice(12);
    else if (last && raw.startsWith("  - Term: ")) last.terms.push(raw.slice(10));
  }
  return verdicts;
}

/** Verdicts on work that simply went ahead with no record: counted by `canon learn`, kept out of the repo's pages. */
export const verdictLog = (): string => join(process.env.CANON_HOME ?? join(homedir(), ".canon"), "verdicts.jsonl");

/**
 * Puts a verdict on the record it judged. A request with no record that was stopped, dropped or overridden becomes an
 * Idea, so it is not proposed again unseen; one that simply went ahead is only logged, since the work itself records it.
 */
export function recordVerdict(repo: string, config: Config, verdict: Verdict, recordId?: string): { id: string; file: string } {
  if (!recordId && verdict.outcome === "proceeded") {
    mkdirSync(dirname(verdictLog()), { recursive: true });
    appendFileSync(verdictLog(), `${JSON.stringify({ ...verdict, product: basename(repo) })}\n`);
    return { id: "logged", file: verdictLog() };
  }
  const target = recordId
    ? findRecord(repo, config, recordId)
    : createRecord(repo, kindByFolder(config, "ideas"), verdict.request, { status: ["stopped", "dropped"].includes(verdict.outcome) ? "dropped" : "accepted", "last-verified": verdict.at.slice(0, 10) }, `# ${verdict.request.replace(/\s+/g, " ")}\n\n## Summary\n${verdict.request.replace(/\s+/g, " ")}\n`);
  appendToSection(repo, target.file, "Verdict", formatVerdict(verdict));
  return { id: target.id, file: target.file };
}

export interface VerdictEntry extends Verdict {
  product: string;
}

function loggedVerdicts(products: Set<string>): VerdictEntry[] {
  if (!existsSync(verdictLog())) return [];
  return readFileSync(verdictLog(), "utf8").split("\n").flatMap((line) => {
    try {
      const entry = JSON.parse(line) as VerdictEntry;
      return products.has(entry.product) ? [entry] : [];
    } catch {
      return [];
    }
  });
}

/** Every verdict on every record in these repos, whatever record kinds each one has, and the logged ones. */
export function readVerdicts(repos: string[]): VerdictEntry[] {
  return [...loggedVerdicts(new Set(repos.map((repo) => basename(repo)))), ...onPages(repos)];
}

function onPages(repos: string[]): VerdictEntry[] {
  return repos.flatMap((repo) => {
    const context = join(repo, ".context");
    if (!existsSync(context)) return [];
    return readdirSync(context, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !["raw", "wiki", "designs"].includes(entry.name))
      .flatMap((folder) =>
        readdirSync(join(context, folder.name))
          .filter((name) => name.endsWith(".md") && name !== "index.md")
          .flatMap((name) => parseVerdicts(readFileSync(join(context, folder.name, name), "utf8")).map((verdict) => ({ ...verdict, product: basename(repo) }))),
      );
  });
}

export interface Rework {
  records: number;
  contradicted: number;
}

/**
 * Rework on records with a weigh verdict and on records without one. A record is reworked when it carries
 * `contradicted:` (see the reviews-and-evals decision); `canon set <id> contradicted=<date>` marks it.
 */
export function reworkRates(repos: string[], configOf: (repo: string) => Config): { withWeigh: Rework; withoutWeigh: Rework } {
  const rates = { withWeigh: { records: 0, contradicted: 0 }, withoutWeigh: { records: 0, contradicted: 0 } };
  for (const repo of repos) {
    for (const record of allRecords(repo, configOf(repo))) {
      const rate = parseVerdicts(record.body).length ? rates.withWeigh : rates.withoutWeigh;
      rate.records += 1;
      if (record.data.contradicted) rate.contradicted += 1;
    }
  }
  return rates;
}
