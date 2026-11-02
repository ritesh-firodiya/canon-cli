import { resolve } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../config/load.ts";
import { addProblem } from "../records/problems.ts";
import { OUTCOMES, recordVerdict, VERDICTS, type Outcome } from "../records/verdicts.ts";
import { claudeAgent, runRecord } from "./run.ts";
import { runTrigger } from "./trigger.ts";

const collect = (value: string, list: string[]) => [...list, value];

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

  const problem = program.command("problem").description("write down what needs solving");
  problem
    .command("add")
    .description("open a problem by hand")
    .argument("<title>", "what is wrong")
    .argument("[repo]", "product repo", ".")
    .option("--source <source>", "who or what raised it", "person")
    .option("--priority <p>", "p0 to p3", "p2")
    .option("--pipeline <name>", "the pipeline it follows")
    .action((title: string, repo: string, options: { source: string; priority: string; pipeline?: string }) => {
      const root = resolve(repo);
      const { id, file } = addProblem(root, loadConfig(root).config, { title, ...options });
      console.log(`${id}: ${file}`);
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

  program
    .command("verdict")
    .description("put a weigh verdict on the record it judged. With no record, it becomes an Idea")
    .argument("[repo]", "product repo", ".")
    .requiredOption("--verdict <verdict>", VERDICTS.join(" | "))
    .requiredOption("--outcome <outcome>", OUTCOMES.join(" | "))
    .requiredOption("--request <text>", "the request, in one line")
    .option("--record <id>", "the record it judged")
    .option("--principles <ids>", "comma-separated, like C-01,C-05", "")
    .option("--reason <text>", "the person's reason, verbatim. Required for an override", "")
    .option("--term <text>", "one agreed term; repeat for each", collect, [] as string[])
    .action((repo: string, options: { verdict: string; outcome: string; request: string; record?: string; principles: string; reason: string; term: string[] }) => {
      if (!(VERDICTS as readonly string[]).includes(options.verdict)) throw new Error(`--verdict must be one of ${VERDICTS.join(", ")}`);
      if (!(OUTCOMES as readonly string[]).includes(options.outcome)) throw new Error(`--outcome must be one of ${OUTCOMES.join(", ")}`);
      if (options.outcome === "overridden" && !options.reason.trim()) throw new Error("--reason is required: an override without a reason teaches nothing");
      const principles = options.principles.split(",").map((id) => id.trim()).filter(Boolean);
      const invalid = principles.filter((id) => !/^C-\d{2}$/.test(id));
      if (invalid.length) throw new Error(`not principle IDs: ${invalid.join(", ")}`);
      const root = resolve(repo);
      const saved = recordVerdict(root, loadConfig(root).config, { at: new Date().toISOString(), verdict: options.verdict, outcome: options.outcome as Outcome, principles, request: options.request.trim(), reason: options.reason.trim(), terms: options.term }, options.record);
      console.log(`${saved.id}: ${saved.file}`);
    });
}
