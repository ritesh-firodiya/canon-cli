import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Command } from "commander";
import { fetchText, runCommand } from "../lib/system.ts";
import type { Env } from "../lib/env.ts";
import { updateCanon } from "./update.ts";

export function registerUpdate(program: Command, env: Env): void {
  program
    .command("update")
    .description("update the canon CLI and its Claude Code plugin to the latest release, then sync this repo")
    .argument("[repo]", "product repo", ".")
    .action(async (repo: string) => {
      for (const line of await updateCanon({ canonRoot: env.canonRoot, run: runCommand, fetchText })) console.log(line);
      const path = resolve(repo);
      if (!existsSync(join(path, ".claude", "canon.yaml"))) return;
      // The new release runs the sync, not this process, which is still the old code.
      const result = spawnSync("canon", ["sync", path], { stdio: "inherit" });
      if (result.error) throw new Error(`could not run canon sync: ${result.error.message}`);
      process.exitCode = result.status ?? 1;
    });
}
