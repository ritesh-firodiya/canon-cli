import { resolve } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../config/load.ts";
import { claudeAgent, runRecord } from "./run.ts";
import { runTrigger } from "./trigger.ts";

export function registerRun(program: Command): void {
  program
    .command("run")
    .description("move a record through its pipeline with an agent, stopping at each gate and cap")
    .argument("<record>", "the record, like PROB-0001")
    .argument("[repo]", "product repo", ".")
    .action((recordId: string, repo: string) => {
      const root = resolve(repo);
      const result = runRecord(root, loadConfig(root).config, recordId, claudeAgent);
      console.log(`${result.status}: ${result.message} ($${result.costUsd.toFixed(2)} this run)`);
      if (result.status === "stopped") process.exitCode = 1;
    });

  program
    .command("trigger")
    .description("read each trigger's source and open problems, joining repeats to the open one. Schedule it with launchd or cron")
    .argument("[id]", "one trigger; all of them when left out")
    .argument("[repo]", "product repo", ".")
    .option("--run", "also run the new problems, up to each trigger's cap")
    .action(async (id: string | undefined, repo: string, options: { run?: boolean }) => {
      const root = resolve(repo);
      const { config } = loadConfig(root);
      const triggers = id ? config.triggers.filter((entry) => entry.id === id) : config.triggers;
      if (triggers.length === 0) throw new Error(id ? `no trigger ${id}` : "no triggers: in context.yaml");
      for (const trigger of triggers) {
        const result = await runTrigger(root, config, trigger, { agent: options.run ? claudeAgent : undefined });
        console.log(`${trigger.id}: ${result.opened.length} opened, ${result.joined.length} joined`);
        for (const message of result.messages) console.log(`  ${message}`);
      }
    });
}
