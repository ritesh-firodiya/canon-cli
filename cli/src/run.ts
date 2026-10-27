import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { ALL_CHECKS } from "./checks/index.ts";
import type { Check, Finding } from "./checks/types.ts";
import { loadConfig } from "./config/load.ts";
import { isDirectory } from "./lib/files.ts";

export interface Report {
  repo: string;
  name: string;
  findings: Finding[];
  skipped: Array<{ check: string; why: string }>;
}

export interface RunOptions {
  checks?: Check[];
  zenoRoot: string;
  estateRoot?: string | null;
  today?: Date;
}

export function runChecks(repo: string, options: RunOptions): Report {
  const report: Report = { repo, name: basename(repo), findings: [], skipped: [] };
  if (!isDirectory(repo)) {
    report.findings.push({ check: "repo", level: "error", message: `no folder at ${repo}` });
    return report;
  }
  let config;
  try {
    config = loadConfig(repo, { estateRoot: options.estateRoot }).config;
  } catch (error) {
    report.findings.push({ check: "config", level: "error", message: (error as Error).message });
    return report;
  }

  for (const check of options.checks ?? ALL_CHECKS) {
    if (check.module && !config.modules.includes(check.module)) {
      report.skipped.push({ check: check.id, why: `module ${check.module} is off` });
      continue;
    }
    try {
      report.findings.push(
        ...check.run({ repo, name: report.name, config, zenoRoot: options.zenoRoot, today: options.today ?? new Date() }),
      );
    } catch (error) {
      report.findings.push({ check: check.id, level: "error", message: `check crashed: ${(error as Error).message}` });
    }
  }
  return report;
}

/** Product repos in the estate: every direct child folder holding a .context/. */
export function findProducts(estateRoot: string): string[] {
  return readdirSync(estateRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(estateRoot, entry.name, ".context")))
    .map((entry) => join(estateRoot, entry.name))
    .sort();
}
