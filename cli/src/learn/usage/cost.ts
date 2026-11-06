import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { findProducts } from "../../enforce/checks/check.ts";
import type { Env } from "../../lib/env.ts";
import { TRANSCRIPTS } from "../../lib/transcripts.ts";
import { loadConfig } from "../../config/load.ts";
import { OUTCOMES, readVerdicts, reworkRates, type Outcome, type Rework, type VerdictEntry } from "../../work/records/verdicts.ts";
import { runsLog } from "../../work/run/run.ts";
import { buildReport, formatReport, formatSkill, installedSkills, newTally, readTranscripts, weekOf, type UsageReport, type WeekRow } from "./usage.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;

export type WeighWeek = WeekRow & Record<Outcome, number>;

export interface WeighReport {
  weeks: WeighWeek[];
  rework: { withWeigh: Rework; withoutWeigh: Rework };
}

/** Weigh per week, for the reviews-and-evals revisit: how often it ran, what the band held back, what its verdicts led to. */
export function weighReport(weeks: WeekRow[], verdicts: VerdictEntry[], since: Date, rework: WeighReport["rework"]): WeighReport {
  const rows = new Map<string, WeighWeek>(weeks.map((row) => [row.week, { ...row, ...Object.fromEntries(OUTCOMES.map((o) => [o, 0])) } as WeighWeek]));
  for (const verdict of verdicts) {
    const at = new Date(verdict.at);
    if (Number.isNaN(at.getTime()) || at < since) continue;
    const week = weekOf(at);
    const row = rows.get(week) ?? ({ week, sessions: 0, weighRuns: 0, weighBlocks: 0, ...Object.fromEntries(OUTCOMES.map((o) => [o, 0])) } as WeighWeek);
    rows.set(week, { ...row, [verdict.outcome]: row[verdict.outcome] + 1 });
  }
  return { weeks: [...rows.values()].sort((a, b) => a.week.localeCompare(b.week)), rework };
}

const percent = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "n/a");
const reworkLine = (label: string, rate: Rework): string => `  ${label}: ${rate.contradicted} of ${rate.records} records reworked (${percent(rate.contradicted, rate.records)})`;

export function formatWeigh(report: WeighReport): string {
  return [
    "",
    "weigh per week (week of · sessions · weigh runs · held for weigh · proceeded / stopped / overridden / dropped)",
    ...report.weeks.map((w) => `  ${w.week}  ${w.sessions} · ${w.weighRuns} (${percent(w.weighRuns, w.sessions)}) · ${w.weighBlocks} · ${w.proceeded} / ${w.stopped} / ${w.overridden} / ${w.dropped}`),
    "rework (records marked contradicted:)",
    reworkLine("with a weigh verdict", report.rework.withWeigh),
    reworkLine("without one", report.rework.withoutWeigh),
  ].join("\n");
}

export interface CostOptions {
  days?: string;
  skill?: string;
  unused?: boolean;
  json?: boolean;
  save?: boolean;
}

/** What local sessions used and would cost at list prices: skills, tools, models and products. */
export async function printCost(env: Env, options: CostOptions): Promise<void> {
  const days = Number(options.days ?? DEFAULT_DAYS);
  if (!Number.isInteger(days) || days <= 0) throw new Error(`--days must be a whole number above 0, not ${options.days}`);
  const tally = newTally(new Date(Date.now() - days * DAY_MS), installedSkills());
  const repos = env.workspace ? findProducts(env.workspace) : [];
  const products = new Set(repos.map((repo) => basename(resolve(repo))));
  await readTranscripts(tally, TRANSCRIPTS, { products, workspace: env.workspace ?? null });
  const usage = buildReport(tally, runsLog(), join(dirname(runsLog()), "routes.jsonl"));
  const report: UsageReport & { weigh: WeighReport } = { ...usage, weigh: weighReport(usage.weeks, readVerdicts(repos), tally.since, reworkRates(repos, (repo) => loadConfig(repo).config)) };
  if (options.save) {
    const file = join(dirname(runsLog()), "usage", `${new Date().toISOString().slice(0, 10)}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.error(`saved ${file}`);
  }
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else if (options.skill) console.log(formatSkill(report, options.skill));
  else if (options.unused) console.log(report.neverUsed.join("\n") || "every installed skill was used");
  else console.log(`${formatReport(report)}\n${formatWeigh(report.weigh)}`);
}
