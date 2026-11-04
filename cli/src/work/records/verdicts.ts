import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Config } from "../../config/schema.ts";
import { appendToSection, createRecord, findRecord, kindByFolder } from "./records.ts";

export const VERDICTS = ["do-it", "do-it-differently", "push-back"] as const;
export const OUTCOMES = ["proceeded", "stopped", "overridden", "dropped"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export interface Verdict {
  at: string;
  verdict: string;
  outcome: Outcome;
  principles: string[];
  request: string;
  reason: string;
  terms: string[];
}

const SEP = " · ";

export function formatVerdict(verdict: Verdict): string {
  const line = `- ${verdict.at.slice(0, 10)}${SEP}${verdict.verdict}${SEP}${verdict.outcome}${SEP}${verdict.principles.join(", ") || "none"}${SEP}${verdict.request.replace(/\s+/g, " ")}`;
  const details = [...(verdict.reason ? [`  - Reason: ${verdict.reason.replace(/\s+/g, " ")}`] : []), ...verdict.terms.map((term) => `  - Term: ${term.replace(/\s+/g, " ")}`)];
  return [line, ...details].join("\n");
}

const LINE = /^- (\d{4}-\d{2}-\d{2}) · ([a-z-]+) · ([a-z]+) · ([^·]+) · (.*)$/;

export function parseVerdicts(text: string): Verdict[] {
  const section = /^## Verdict[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1] ?? "";
  const verdicts: Verdict[] = [];
  for (const raw of section.split("\n")) {
    const match = LINE.exec(raw);
    const last = verdicts[verdicts.length - 1];
    if (match) {
      const [, at, verdict, outcome, principles, request] = match;
      verdicts.push({ at, verdict, outcome: outcome as Outcome, principles: principles === "none" ? [] : principles.split(", "), request, reason: "", terms: [] });
    } else if (last && raw.startsWith("  - Reason: ")) last.reason = raw.slice(12);
    else if (last && raw.startsWith("  - Term: ")) last.terms.push(raw.slice(10));
  }
  return verdicts;
}

/** Puts a verdict on the record it judged. A request with no record yet becomes an Idea, so a dropped one is not proposed again unseen. */
export function recordVerdict(repo: string, config: Config, verdict: Verdict, recordId?: string): { id: string; file: string } {
  const target = recordId
    ? findRecord(repo, config, recordId)
    : createRecord(repo, kindByFolder(config, "ideas"), verdict.request, { status: ["stopped", "dropped"].includes(verdict.outcome) ? "dropped" : "accepted", "last-verified": verdict.at.slice(0, 10) }, `# ${verdict.request.replace(/\s+/g, " ")}\n\n## Summary\n${verdict.request.replace(/\s+/g, " ")}\n`);
  appendToSection(repo, target.file, "Verdict", formatVerdict(verdict));
  return { id: target.id, file: target.file };
}

export interface VerdictEntry extends Verdict {
  product: string;
}

/** Every verdict on every record in these repos, whatever record kinds each one has. */
export function readVerdicts(repos: string[]): VerdictEntry[] {
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
