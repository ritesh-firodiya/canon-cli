import { resolve } from "node:path";
import type { Command } from "commander";
import { exitCode, formatReports } from "./format.ts";
import { findProducts, runChecks } from "./check.ts";
import { compareCopies, syncCopies } from "./shared-files.ts";
import { loadConfig } from "../../config/load.ts";
import { constitutionTitles, resolveStandards } from "../standards/standards.ts";
import { buildStatus } from "../status/status.ts";
import { requireWorkspace, type Env } from "../../lib/env.ts";

interface CheckOptions {
  all?: boolean;
  json?: boolean;
  quiet?: boolean;
  status?: boolean;
  standards?: boolean;
  constitution?: boolean;
  copies?: boolean;
  sync?: boolean;
}

function printStandards(env: Env, repo: string, options: CheckOptions): void {
  const { config } = loadConfig(repo);
  if (options.constitution) {
    const titles = constitutionTitles(env.canonRoot, config.standards);
    console.log(options.json ? JSON.stringify(titles) : titles.map((title) => `- ${title}`).join("\n"));
    return;
  }
  const standards = resolveStandards(env.canonRoot, config.standards);
  console.log(options.json ? JSON.stringify(standards, null, 2) : standards.map((s) => `${s.name.padEnd(18)} ${s.path}`).join("\n"));
}

function printCopies(repo: string, options: CheckOptions): void {
  const { config } = loadConfig(repo);
  if (options.sync) {
    const written = syncCopies(repo, config);
    console.log(written.length ? written.map((file) => `  synced: ${file}`).join("\n") : "  nothing to sync");
    return;
  }
  const off = compareCopies(repo, config).filter((entry) => entry.state !== "same");
  console.log(off.length ? off.map(({ pair, state }) => `  ${state}: ${pair.to}`).join("\n") : "  ok");
  if (off.length) process.exitCode = 1;
}

export function registerCheck(program: Command, env: Env): void {
  program
    .command("check")
    .description("check that a product follows the standards (read-only), or show what applies to it")
    .argument("[repo]", "product repo", ".")
    .option("--all", "check every product in the workspace")
    .option("--json", "print machine-readable JSON")
    .option("-q, --quiet", "hide products with no findings")
    .option("--status", "one screen: canon version, config and the check summary")
    .option("--standards", "list the standards that apply: canon's defaults, then the ones the repo imports")
    .option("--constitution", "with --standards: only the principle titles")
    .option("--copies", "compare the shared files with copies.source")
    .option("--sync", "with --copies: overwrite the drifted ones (never adds a missing file)")
    .action((repo: string, options: CheckOptions) => {
      const path = resolve(repo);
      if (options.status) return void console.log(buildStatus(path, { canonRoot: env.canonRoot }));
      if (options.standards || options.constitution) return printStandards(env, path, options);
      if (options.copies) return printCopies(path, options);
      const repos = options.all ? findProducts(requireWorkspace(env)) : [path];
      const reports = repos.map((each) => runChecks(each, { canonRoot: env.canonRoot }));
      console.log(options.json ? JSON.stringify(reports, null, 2) : formatReports(reports, { quiet: options.quiet }));
      process.exitCode = exitCode(reports);
    });
}
