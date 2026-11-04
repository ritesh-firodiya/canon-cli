import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { findProducts } from "../../enforce/checks/check.ts";
import type { Env } from "../../lib/env.ts";
import { TRANSCRIPTS } from "../../lib/transcripts.ts";
import { runsLog } from "../../work/run/run.ts";
import { buildReport, formatReport, formatSkill, installedSkills, newTally, readTranscripts } from "./usage.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;

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
  const products = new Set(env.workspace ? findProducts(env.workspace).map((repo) => basename(resolve(repo))) : []);
  await readTranscripts(tally, TRANSCRIPTS, { products, workspace: env.workspace ?? null });
  const report = buildReport(tally, runsLog(), join(dirname(runsLog()), "routes.jsonl"));
  if (options.save) {
    const file = join(dirname(runsLog()), "usage", `${new Date().toISOString().slice(0, 10)}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.error(`saved ${file}`);
  }
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else if (options.skill) console.log(formatSkill(report, options.skill));
  else if (options.unused) console.log(report.neverUsed.join("\n") || "every installed skill was used");
  else console.log(formatReport(report));
}
