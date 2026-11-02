import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../config/load.ts";
import { approveStage } from "./pipeline.ts";

function personName(root: string): string {
  try {
    return execFileSync("git", ["-C", root, "config", "user.name"], { encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export function registerApprove(program: Command): void {
  program
    .command("approve")
    .description("record that a person reviewed and approved a stage on a record, dated now (needs a terminal: an agent cannot run it)")
    .argument("<stage>", "the stage's id in the record's pipeline")
    .argument("[repo]", "product repo", ".")
    .requiredOption("--record <id>", "the record being approved, like PLAN-0001")
    .option("--note <text>", "what was reviewed", "")
    .action((stageId: string, repo: string, options: { record: string; note: string }) => {
      // shortcut: a terminal check stops an agent's tool call, not a person's script; Canon Cloud's reviews are the real lock.
      if (!process.stdin.isTTY || process.env.CANON_RUN) throw new Error("approvals are for people: run this yourself in a terminal");
      const root = resolve(repo);
      const approval = approveStage(root, loadConfig(root).config, options.record, stageId, personName(root), options.note);
      console.log(`${options.record}: ${stageId} approved by ${approval.by} at ${approval.at}`);
    });
}
