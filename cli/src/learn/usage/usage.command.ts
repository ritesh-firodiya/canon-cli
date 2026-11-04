import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { Command } from "commander";
import { findProducts } from "../../enforce/checks/check.ts";
import type { Env } from "../../lib/env.ts";
import { runsLog } from "../../work/run/run.ts";
import { buildReport, formatReport, formatSkill, installedSkills, newTally, readTranscripts } from "./usage.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

interface UsageOptions {
  days: string;
  skill?: string;
  unused?: boolean;
  json?: boolean;
  save?: boolean;
}

export function registerUsage(program: Command, env: Env): void {
  program
    .command("usage")
    .description("what your local Claude sessions used and what it would cost at list prices: skills, tools, models and products")
    .option("--days <n>", "how many days back", "30")
    .option("--skill <name>", "one skill in full: what is costly inside it")
    .option("--unused", "list installed skills never used in the period")
    .option("--json", "the whole report as JSON")
    .option("--save", "also save the report under ~/.canon/usage/, to compare later")
    .action(async (options: UsageOptions) => {
      const days = Number(options.days);
      if (!Number.isInteger(days) || days <= 0) throw new Error(`--days must be a whole number above 0, not ${options.days}`);
      const tally = newTally(new Date(Date.now() - days * DAY_MS), installedSkills());
      const products = new Set(env.workspace ? findProducts(env.workspace).map((repo) => basename(resolve(repo))) : []);
      await readTranscripts(tally, join(homedir(), ".claude", "projects"), { products, workspace: env.workspace ?? null });
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
    });
}
