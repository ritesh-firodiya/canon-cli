import { resolve } from "node:path";
import type { Command } from "commander";
import { compareCopies, syncCopies } from "../checks/shared-files.ts";
import { loadConfig } from "../config/load.ts";
import type { Env } from "../lib/env.ts";

export function registerCopies(program: Command, env: Env): void {
  program
    .command("copies")
    .description("compare a product's shared files with copies.source; --sync overwrites the drifted ones")
    .argument("[repo]", "product repo", ".")
    .option("--sync", "overwrite drifted copies from the source (never adds a missing file)")
    .action((repo: string, options: { sync?: boolean }) => {
      const path = resolve(repo);
      const { config } = loadConfig(path);
      if (options.sync) {
        const written = syncCopies(path, config);
        console.log(written.length ? written.map((file) => `  synced: ${file}`).join("\n") : "  nothing to sync");
        return;
      }
      const off = compareCopies(path, config).filter((entry) => entry.state !== "same");
      console.log(off.length ? off.map(({ pair, state }) => `  ${state}: ${pair.to}`).join("\n") : "  ok");
      if (off.length) process.exitCode = 1;
    });
}
