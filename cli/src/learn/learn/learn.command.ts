import { homedir } from "node:os";
import type { Command } from "commander";
import { proposals, readDecisions, readVerdicts, recordDecision, summarise, type Proposal } from "./learn.ts";
import { findProducts } from "../../enforce/checks/check.ts";
import { requireWorkspace, type Env } from "../../lib/env.ts";
import { printFlow } from "../flow/print.ts";
import { printCost, type CostOptions } from "../usage/cost.ts";

const DEFAULT_THRESHOLD = 3;
// The decisions log lives in the user's home: it spans every product and must survive canon upgrades.
const DECISIONS_HOME = homedir();

interface LearnOptions extends CostOptions {
  threshold: string;
  approve?: string;
  reject?: string;
  note: string;
  flow?: string[];
  write?: boolean;
  cost?: boolean;
}

function printVerdicts(env: Env, options: LearnOptions): void {
  const entries = readVerdicts(findProducts(requireWorkspace(env)));
  const found = proposals(entries, { threshold: Number(options.threshold), decisions: readDecisions(DECISIONS_HOME) });
  const target = options.approve ?? options.reject;
  if (target) return decide(found, target, options);
  const summary = summarise(entries);
  if (options.json) return void console.log(JSON.stringify({ verdicts: summary, proposals: found }, null, 2));
  console.log(`${summary.total} verdict(s) logged: ${summary.proceeded} went ahead, ${summary.stopped} stopped, ${summary.overridden} overridden, ${summary.dropped} dropped`);
  if (found.length === 0) console.log("no proposals");
  for (const proposal of found) {
    console.log(`\n${proposal.id}\n  ${proposal.summary}\n  products: ${proposal.products.join(", ")}`);
    for (const reason of proposal.reasons) console.log(`  - "${reason}"`);
  }
}

function decide(found: Proposal[], target: string, options: LearnOptions): void {
  const proposal = found.find((p) => p.id === target);
  if (!proposal) throw new Error(`no open proposal "${target}" — run \`canon learn\` to list them`);
  recordDecision(DECISIONS_HOME, { id: target, decision: options.approve ? "approved" : "rejected", count: proposal.count, note: options.note });
  console.log(`${options.approve ? "approved" : "rejected"} ${target}`);
}

export function registerLearn(program: Command, env: Env): void {
  program
    .command("learn")
    .description("what history says: verdicts and the rule changes they propose; --flow for how far work got; --cost for what sessions used")
    .option("--threshold <n>", "overrides of one principle before it is proposed", String(DEFAULT_THRESHOLD))
    .option("--approve <id>", "mark a proposal approved (then edit the standard)")
    .option("--reject <id>", "mark a proposal rejected; it returns only with new evidence")
    .option("--note <text>", "why, for --approve / --reject", "")
    .option("--flow <product...>", "how far each local Claude conversation about these products got against the pipeline")
    .option("--write", "with --flow: also write <product>/.context/metrics/flow.json")
    .option("--cost", "what local Claude sessions used and would cost at list prices: skills, tools, models, products")
    .option("--days <n>", "with --cost: how many days back", "30")
    .option("--skill <name>", "with --cost: one skill in full")
    .option("--unused", "with --cost: installed skills never used in the period")
    .option("--save", "with --cost: also save the report under ~/.canon/usage/")
    .option("--json", "print JSON, for the learn skill and scripts")
    .action(async (options: LearnOptions) => {
      if (options.flow) return printFlow(env, options.flow, options);
      if (options.cost) return printCost(env, options);
      printVerdicts(env, options);
    });
}
