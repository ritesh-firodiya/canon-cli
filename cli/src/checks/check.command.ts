import { resolve } from "node:path";
import type { Command } from "commander";
import { exitCode, formatReports } from "./format.ts";
import { findProducts, runChecks } from "./check.ts";
import { requireWorkspace, type Env } from "../lib/env.ts";

export function registerCheck(program: Command, env: Env): void {
  program
    .command("check")
    .description("check that a product follows the standards (read-only)")
    .argument("[repo]", "product repo", ".")
    .option("--all", "check every product in the workspace")
    .option("--json", "print machine-readable JSON")
    .option("-q, --quiet", "hide products with no findings")
    .action((repo: string, options: { all?: boolean; json?: boolean; quiet?: boolean }) => {
      const repos = options.all ? findProducts(requireWorkspace(env)) : [resolve(repo)];
      const reports = repos.map((path) => runChecks(path, { canonRoot: env.canonRoot }));
      console.log(options.json ? JSON.stringify(reports, null, 2) : formatReports(reports, { quiet: options.quiet }));
      process.exitCode = exitCode(reports);
    });
}
