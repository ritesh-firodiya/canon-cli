import { resolve } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../config/load.ts";
import { constitutionTitles, resolveStandards } from "../standards.ts";
import type { Env } from "./env.ts";

export function registerStandards(program: Command, env: Env): void {
  program
    .command("standards")
    .description("list the standards that apply to a repo: canon's defaults, then the estate's and the repo's")
    .argument("[repo]", "product repo", ".")
    .option("--json", "print machine-readable JSON")
    .option("--constitution", "print only the principle titles, canon's then any added ones")
    .action((repo: string, options: { json?: boolean; constitution?: boolean }) => {
      const { config } = loadConfig(resolve(repo));
      if (options.constitution) {
        const titles = constitutionTitles(env.canonRoot, config.standards);
        console.log(options.json ? JSON.stringify(titles) : titles.map((title) => `- ${title}`).join("\n"));
        return;
      }
      const standards = resolveStandards(env.canonRoot, config.standards);
      if (options.json) {
        console.log(JSON.stringify(standards, null, 2));
        return;
      }
      for (const standard of standards) console.log(`${standard.name.padEnd(18)} ${standard.path}`);
    });
}
