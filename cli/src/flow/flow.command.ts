import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Command } from "commander";
import { findProducts } from "../check/check.ts";
import { loadConfig } from "../config/load.ts";
import { flow } from "./flow.ts";
import { allSessions } from "./sessions.ts";
import { requireWorkspace, type Env } from "../lib/env.ts";

export function registerFlow(program: Command, env: Env): void {
  program
    .command("flow")
    .description("how far each local Claude conversation about a product got against its pipeline, and how long each step took")
    .argument("<product...>", "product folder names in the workspace")
    .option("--write", "also write <product>/.context/metrics/flow.json")
    .action((products: string[], options: { write?: boolean }) => {
      const workspace = requireWorkspace(env);
      for (const product of products) if (!existsSync(join(workspace, product, ".git"))) throw new Error(`${product}: not a repo under ${workspace}`);
      // A renamed product's conversations under its old folder name are still about it.
      const formerly = new Map(findProducts(workspace).map((repo) => [resolve(repo).split("/").pop(), loadConfig(repo).config.formerly]));
      const sessions = allSessions(workspace);
      for (const product of products) {
        const result = flow(workspace, product, sessions, formerly.get(product) ?? []);
        console.log(`${product} ${result.stages.map((s) => `${s.id} ${s.count}`).join(" → ")} | since ${result.since}`);
        if (!options.write) continue;
        const out = join(workspace, product, ".context", "metrics", "flow.json");
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
      }
    });
}
