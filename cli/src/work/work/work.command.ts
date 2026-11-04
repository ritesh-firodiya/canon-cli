import { dirname, resolve } from "node:path";
import type { Command } from "commander";
import { productRoot } from "../../serve/band/band.ts";
import { loadConfig } from "../../config/load.ts";
import { formatQueue, queueOf } from "../records/queue.ts";
import { clearWork, followEdit, readWork, selectWork, setStage } from "./work.ts";

interface WorkOptions {
  repo: string;
  stage?: string;
  clear?: boolean;
  edit?: string;
}

function requireProduct(path: string): string {
  const repo = productRoot(path);
  if (!repo) throw new Error(`no product at ${path}`);
  return repo;
}

function runWork(recordId: string | undefined, options: WorkOptions): void {
  if (process.env.CANON_RUN) throw new Error("an agent run has its record: canon run moves its stage");
  if (options.edit) {
    const path = resolve(options.edit);
    // A file in no product, like a temp file, says nothing about the work.
    const repo = productRoot(dirname(path));
    if (repo) followEdit(repo, loadConfig(repo).config, path);
    return;
  }
  const repo = requireProduct(options.repo);
  if (options.clear) {
    clearWork(repo);
    console.log("nothing selected");
    return;
  }
  const { config } = loadConfig(repo);
  if (recordId) selectWork(repo, config, recordId);
  const selected = readWork(repo);
  if (options.stage) {
    if (!selected) throw new Error("select a record first: canon work <record>");
    setStage(repo, config, selected, options.stage);
  }
  console.log(selected ? `working on ${selected}` : `nothing selected: canon work <record>\n${formatQueue(queueOf(repo, config))}`);
}

export function registerWork(program: Command): void {
  program
    .command("work")
    .description("select the record you are working on, which the band follows. It approves nothing")
    .argument("[record]", "the record, like PLAN-0001")
    .option("--repo <path>", "any folder in the product repo", ".")
    .option("--stage <id>", "put the selected record at this stage; an unapproved gate in the way holds it there")
    .option("--clear", "select nothing")
    .option("--edit <path>", "tell canon a file was edited (the band does this)")
    .action(runWork);
}
