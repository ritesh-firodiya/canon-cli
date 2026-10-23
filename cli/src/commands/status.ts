import { resolve } from "node:path";
import type { Command } from "commander";
import { buildStatus } from "../status.ts";
import type { Env } from "./env.ts";

export function registerStatus(program: Command, env: Env): void {
  program
    .command("status")
    .description("one screen: zeno version, config, check summary")
    .argument("[repo]", "product repo", ".")
    .action((repo: string) => {
      console.log(buildStatus(resolve(repo), { zenoRoot: env.zenoRoot }));
    });
}
