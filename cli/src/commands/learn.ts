import { homedir } from "node:os";
import type { Command } from "commander";
import { proposals, readDecisions, readVerdicts, recordDecision, summarise } from "../learn.ts";
import { findProducts } from "../check.ts";
import { requireWorkspace, type Env } from "../lib/env.ts";

const DEFAULT_THRESHOLD = 3;
// The decisions log lives in the user's home: it spans every product and must survive canon upgrades.
const DECISIONS_HOME = homedir();

export function registerLearn(program: Command, env: Env): void {
  program
    .command("learn")
    .description("show how often the gate stops work, and turn overrides across products into proposals to change the rules")
    .option("--threshold <n>", "overrides of one principle before it is proposed", String(DEFAULT_THRESHOLD))
    .option("--approve <id>", "mark a proposal approved (then edit the standard)")
    .option("--reject <id>", "mark a proposal rejected; it returns only with new evidence")
    .option("--note <text>", "why, for --approve / --reject", "")
    .action((options: { threshold: string; approve?: string; reject?: string; note: string }) => {
      const entries = readVerdicts(findProducts(requireWorkspace(env)));
      const found = proposals(entries, { threshold: Number(options.threshold), decisions: readDecisions(DECISIONS_HOME) });
      const target = options.approve ?? options.reject;
      if (target) {
        const proposal = found.find((p) => p.id === target);
        if (!proposal) throw new Error(`no open proposal "${target}" — run \`canon learn\` to list them`);
        recordDecision(DECISIONS_HOME, { id: target, decision: options.approve ? "approved" : "rejected", count: proposal.count, note: options.note });
        console.log(`${options.approve ? "approved" : "rejected"} ${target}`);
        return;
      }
      const s = summarise(entries);
      console.log(`${s.total} verdict(s) logged: ${s.proceeded} went ahead, ${s.stopped} stopped, ${s.overridden} overridden, ${s.dropped} dropped`);
      if (found.length === 0) console.log("no proposals");
      for (const proposal of found) {
        console.log(`\n${proposal.id}\n  ${proposal.summary}\n  products: ${proposal.products.join(", ")}`);
        for (const reason of proposal.reasons) console.log(`  - "${reason}"`);
      }
    });
}
