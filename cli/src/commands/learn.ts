import type { Command } from "commander";
import { proposals, readDecisions, readVerdicts, recordDecision } from "../learn.ts";
import { findProducts } from "../run.ts";
import { requireEstate, type Env } from "./env.ts";

const DEFAULT_THRESHOLD = 3;

export function registerLearn(program: Command, env: Env): void {
  program
    .command("learn")
    .description("turn overridden verdicts across products into proposals to change the rules")
    .option("--threshold <n>", "overrides of one principle before it is proposed", String(DEFAULT_THRESHOLD))
    .option("--approve <id>", "mark a proposal approved (then edit the standard)")
    .option("--reject <id>", "mark a proposal rejected; it returns only with new evidence")
    .option("--note <text>", "why, for --approve / --reject", "")
    .action((options: { threshold: string; approve?: string; reject?: string; note: string }) => {
      const entries = readVerdicts(findProducts(requireEstate(env)));
      const found = proposals(entries, { threshold: Number(options.threshold), decisions: readDecisions(env.zenoRoot) });
      const target = options.approve ?? options.reject;
      if (target) {
        const proposal = found.find((p) => p.id === target);
        if (!proposal) throw new Error(`no open proposal "${target}" — run \`zeno learn\` to list them`);
        recordDecision(env.zenoRoot, { id: target, decision: options.approve ? "approved" : "rejected", count: proposal.count, note: options.note });
        console.log(`${options.approve ? "approved" : "rejected"} ${target}`);
        return;
      }
      console.log(`${entries.length} overridden verdict(s) logged across the estate`);
      if (found.length === 0) console.log("no proposals");
      for (const proposal of found) {
        console.log(`\n${proposal.id}\n  ${proposal.summary}\n  products: ${proposal.products.join(", ")}`);
        for (const reason of proposal.reasons) console.log(`  - "${reason}"`);
      }
    });
}
