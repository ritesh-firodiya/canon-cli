import { resolve } from "node:path";
import type { Command } from "commander";
import { exitCode, formatReports } from "../format.ts";
import { CACHE_DIR, fetchText, runCommand } from "../lib/system.ts";
import { runChecks } from "../run.ts";
import { syncRepo } from "../sync.ts";
import type { Env } from "./env.ts";

export function registerSync(program: Command, env: Env): void {
  program
    .command("sync")
    .description("refresh pack docs and the search index, move the pinned zeno version, then check")
    .argument("[repo]", "product repo", ".")
    .action(async (repo: string) => {
      const path = resolve(repo);
      const result = await syncRepo(path, { zenoRoot: env.zenoRoot, estateRoot: env.estateRoot ?? undefined, cacheDir: CACHE_DIR, fetchText, run: runCommand });
      console.log(`packs refreshed: ${result.packs.join(", ") || "none"}`);
      if (result.version) console.log(`zeno ${result.version.from ?? "unpinned"} → ${result.version.to}`);
      const report = runChecks(path, { zenoRoot: env.zenoRoot });
      console.log(formatReports([report]));
      process.exitCode = exitCode([report]);
    });
}
