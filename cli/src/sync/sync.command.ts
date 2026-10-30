import { resolve } from "node:path";
import type { Command } from "commander";
import { exitCode, formatReports } from "../check/format.ts";
import { CACHE_DIR, fetchText, runCommand } from "../lib/system.ts";
import { runChecks } from "../check/check.ts";
import { syncRepo } from "./sync.ts";
import type { Env } from "../lib/env.ts";

export function registerSync(program: Command, env: Env): void {
  program
    .command("sync")
    .description("refresh pack docs and the search index, move the pinned canon version, then check")
    .argument("[repo]", "product repo", ".")
    .action(async (repo: string) => {
      const path = resolve(repo);
      const result = await syncRepo(path, { canonRoot: env.canonRoot, cacheDir: CACHE_DIR, fetchText, run: runCommand });
      console.log(`packs refreshed: ${result.packs.join(", ") || "none"}`);
      if (result.base) console.log("architecture base updated from canon's template");
      if (result.version) console.log(`canon ${result.version.from ?? "unpinned"} → ${result.version.to}`);
      const report = runChecks(path, { canonRoot: env.canonRoot });
      console.log(formatReports([report]));
      process.exitCode = exitCode([report]);
    });
}
