import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Command } from "commander";
import { exitCode, formatReports } from "../../enforce/checks/format.ts";
import { runChecks } from "../../enforce/checks/check.ts";
import { CACHE_DIR, fetchText, runCommand } from "../../lib/system.ts";
import { CONFIG_FILE } from "../../config/schema.ts";
import type { Env } from "../../lib/env.ts";
import { formatModels, writeModels } from "../models/models.ts";
import { syncRepo } from "../../know/sync/sync.ts";
import { updateCanon } from "./update.ts";

/** What a release changes in a repo: pack docs, the search index, the pinned version, the models; then the check. */
async function refresh(env: Env, repo: string): Promise<void> {
  console.log(formatModels(await writeModels()));
  if (!existsSync(join(repo, CONFIG_FILE))) return;
  const result = await syncRepo(repo, { canonRoot: env.canonRoot, cacheDir: CACHE_DIR, fetchText, run: runCommand });
  console.log(`packs refreshed: ${result.packs.join(", ") || "none"}`);
  if (result.base) console.log("architecture base updated from canon's template");
  if (result.version) console.log(`canon ${result.version.from ?? "unpinned"} → ${result.version.to}`);
  const report = runChecks(repo, { canonRoot: env.canonRoot });
  console.log(formatReports([report]));
  process.exitCode = exitCode([report]);
}

export function registerUpdate(program: Command, env: Env): void {
  program
    .command("update")
    .description("update the canon CLI and its Claude Code plugin to the latest release, then refresh this repo: packs, search index, pinned version, models")
    .argument("[repo]", "product repo", ".")
    .option("--refresh", "only refresh this repo and the models, installing nothing")
    .action(async (repo: string, options: { refresh?: boolean }) => {
      const path = resolve(repo);
      if (options.refresh) return refresh(env, path);
      for (const line of await updateCanon({ canonRoot: env.canonRoot, run: runCommand, fetchText })) console.log(line);
      // The new release refreshes, not this process, which is still the old code.
      const result = spawnSync("canon", ["update", "--refresh", path], { stdio: "inherit" });
      if (result.error) throw new Error(`could not run canon update --refresh: ${result.error.message}`);
      process.exitCode = result.status ?? 1;
    });
}
