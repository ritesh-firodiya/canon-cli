import { resolve } from "node:path";
import type { Command } from "commander";
import { buildStatus } from "../status.ts";
import type { Env } from "../lib/env.ts";

export function registerStatus(program: Command, env: Env): void {
  program
    .command("status")
    .description("one screen: canon version, config, check summary")
    .argument("[repo]", "product repo", ".")
    .action((repo: string) => {
      console.log(buildStatus(resolve(repo), { canonRoot: env.canonRoot }));
    });
}
