import { resolve } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../config/load.ts";
import { describeRecords } from "./describe.ts";
import { newPage } from "./new.ts";
import { formatQueue, queueOf } from "./queue.ts";
import { OUTCOMES, recordVerdict, VERDICTS, type Outcome } from "./verdicts.ts";

const collect = (value: string, list: string[]) => [...list, value];

export function registerRecords(program: Command): void {
  program
    .command("new")
    .description("start a page from its template: problem, idea, experiment, plan, feature, bug, discovery, finding, decision, or a kind of your own")
    .argument("<kind>", "what to write")
    .argument("<title>", "its title")
    .argument("[repo]", "product repo", ".")
    .option("--set <field=value>", "a frontmatter field, like problem=PROB-0001; repeat for each", collect, [] as string[])
    .action((kind: string, title: string, repo: string, options: { set: string[] }) => {
      const fields = Object.fromEntries(
        options.set.map((pair) => {
          const at = pair.indexOf("=");
          if (at < 1) throw new Error(`--set needs field=value, not "${pair}"`);
          return [pair.slice(0, at), pair.slice(at + 1)];
        }),
      );
      const root = resolve(repo);
      const { id, file } = newPage(root, loadConfig(root).config, kind, title, fields);
      console.log(`${id}: ${file}`);
    });

  program
    .command("records")
    .description("each record kind here, its fields and sections, what each status and priority means, and who owns work by default")
    .argument("[repo]", "product repo", ".")
    .action((repo: string) => {
      console.log(describeRecords(loadConfig(resolve(repo)).config));
    });

  program
    .command("queue")
    .description("open work, most urgent first, with who owns it and what it waits for")
    .argument("[repo]", "product repo", ".")
    .option("--owner <name>", "only this owner's work")
    .option("--json", "print JSON, for scripts")
    .action((repo: string, options: { owner?: string; json?: boolean }) => {
      const root = resolve(repo);
      const rows = queueOf(root, loadConfig(root).config).filter((row) => !options.owner || row.owner === options.owner);
      console.log(options.json ? JSON.stringify(rows, null, 2) : formatQueue(rows));
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
