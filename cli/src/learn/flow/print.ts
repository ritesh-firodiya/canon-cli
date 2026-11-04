import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { findProducts } from "../../enforce/checks/check.ts";
import { loadConfig } from "../../config/load.ts";
import { requireWorkspace, type Env } from "../../lib/env.ts";
import { flow } from "./flow.ts";
import { allSessions } from "./sessions.ts";

/** How far each local conversation about each product got against its pipeline; `write` saves metrics/flow.json. */
export function printFlow(env: Env, products: string[], options: { write?: boolean }): void {
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
}
