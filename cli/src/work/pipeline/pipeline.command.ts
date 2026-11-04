import { resolve } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../../config/load.ts";
import { stagesOf } from "./pipeline.ts";
import type { Env } from "../../lib/env.ts";

export function registerPipeline(program: Command, _env: Env): void {
  program
    .command("pipeline")
    .description("a pipeline's stages in order, the forks between them, and where each stands")
    .argument("[repo]", "product repo", ".")
    .option("--name <name>", "which pipeline", "default")
    .option("--json", "print JSON, for scripts")
    .action((repo: string, options: { name: string; json?: boolean }) => {
      const root = resolve(repo);
      const { config } = loadConfig(root);
      const stages = stagesOf(root, config, options.name);
      if (options.json) {
        console.log(JSON.stringify(stages, null, 2));
        return;
      }
      console.log(`pipelines: ${Object.keys(config.pipelines).join(", ")}`);
      stages.forEach((s, i) => {
        const gate = s.gate ? (s.approved ? "  gate approved" : "  gate open") : "";
        // A stage that only follows the one above it needs no note; a fork says where it may come from.
        const fork = i > 0 && (s.after.length !== 1 || s.after[0] !== stages[i - 1].id) ? `  after ${s.after.join(", ")}` : "";
        console.log(`${s.startedAt ? "●" : "○"} ${s.id.padEnd(14)}${s.startedAt ? ` started (${s.startedAt})` : " not started"}${gate}${fork}`);
      });
    });
}
