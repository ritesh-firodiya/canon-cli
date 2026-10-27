import { resolve } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../config/load.ts";
import { stagesOf } from "../pipeline.ts";
import type { Env } from "../lib/env.ts";

export function registerPipeline(program: Command, env: Env): void {
  program
    .command("pipeline")
    .description("the repo's stages in order — and where each stands")
    .argument("[repo]", "product repo", ".")
    .option("--json", "print JSON, for scripts")
    .action((repo: string, options: { json?: boolean }) => {
      const root = resolve(repo);
      const stages = stagesOf(root, loadConfig(root).config.pipeline);
      if (options.json) {
        console.log(JSON.stringify(stages, null, 2));
        return;
      }
      if (stages.length === 0) {
        console.log("no pipeline: in canon.yaml");
        return;
      }
      for (const s of stages) {
        const gate = s.gate ? (s.approved ? "  gate approved" : "  gate open") : "";
        console.log(`${s.startedAt ? "●" : "○"} ${s.id.padEnd(14)}${s.startedAt ? ` started (${s.startedAt})` : " not started"}${gate}`);
      }
    });
}
