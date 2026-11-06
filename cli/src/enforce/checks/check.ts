import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { ALL_CHECKS } from "./index.ts";
import type { Check, Finding } from "./types.ts";
import { loadConfig } from "../../config/load.ts";
import { isDirectory } from "../../lib/files.ts";

export interface Report {
  repo: string;
  name: string;
  findings: Finding[];
  skipped: Array<{ check: string; why: string }>;
}

/** The person's calendar day, at UTC midnight like a `2026-11-07` read from a page, so a page dated today is never "in the future". */
export const calendarDay = (now: Date): Date => new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

export interface RunOptions {
  checks?: Check[];
  canonRoot: string;
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
    config = loadConfig(repo).config;
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
        ...check.run({ repo, name: report.name, config, canonRoot: options.canonRoot, today: options.today ?? calendarDay(new Date()) }),
      );
    } catch (error) {
      report.findings.push({ check: check.id, level: "error", message: `check crashed: ${(error as Error).message}` });
    }
  }
  return report;
}

/** Product repos in a workspace: every direct child folder holding a .context/. */
export function findProducts(workspace: string): string[] {
  return readdirSync(workspace, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(workspace, entry.name, ".context")))
    .map((entry) => join(workspace, entry.name))
    .sort();
}

/**
 * The folder holding the product repos: the parent of the git repo `start` sits in, or `start`
 * itself outside any repo. Null when that folder holds no product.
 */
export function findWorkspace(start: string): string | null {
  let folder = resolve(start);
  while (!existsSync(join(folder, ".git")) && dirname(folder) !== folder) folder = dirname(folder);
  const workspace = existsSync(join(folder, ".git")) ? dirname(folder) : resolve(start);
  try {
    return findProducts(workspace).length > 0 ? workspace : null;
  } catch {
    // A folder we may not list (a sandbox, a locked parent) holds no product we can see.
    return null;
  }
}
