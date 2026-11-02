import { resolve } from "node:path";
import type { Command } from "commander";
import type { Env } from "../lib/env.ts";
import { buildBand } from "./band.ts";

export function registerBand(program: Command, env: Env): void {
  program
    .command("band")
    .description("what the band above the Claude Code prompt shows about a repo, as JSON")
    .argument("[repo]", "any folder in the product repo", ".")
    .action((repo: string) => {
      console.log(JSON.stringify(buildBand(resolve(repo), { canonRoot: env.canonRoot }), null, 2));
    });
}
