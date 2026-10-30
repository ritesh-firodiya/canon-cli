import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import type { Command } from "commander";
import { findProducts } from "../check.ts";
import { loadConfig } from "../config/load.ts";
import { requireWorkspace, type Env } from "../lib/env.ts";

/** Runs one of canon's Python scripts with the terminal attached, and passes its exit code on. */
function runScript(env: Env, script: string, args: string[], extraEnv: Record<string, string> = {}): void {
  const result = spawnSync("python3", [join(env.canonRoot, "scripts", script), ...args], { stdio: "inherit", env: { ...process.env, ...extraEnv } });
  if (result.error) throw new Error(`could not run python3: ${result.error.message}`);
  process.exitCode = result.status ?? 1;
}

export function registerScripts(program: Command, env: Env): void {
  program
    .command("flow")
    .description("how far each local Claude conversation about a product got against its pipeline, and how long each step took")
    .argument("<product...>", "product folder names in the workspace")
    .option("--write", "also write <product>/.context/metrics/flow.json")
    .action((products: string[], options: { write?: boolean }) => {
      const workspace = requireWorkspace(env);
      const formerly = Object.fromEntries(findProducts(workspace).map((repo) => [resolve(repo).split("/").pop(), loadConfig(repo).config.formerly]));
      runScript(env, "flow.py", [...products, ...(options.write ? ["--write"] : [])], {
        CANON_WORKSPACE: workspace,
        CANON_FLOW_FORMERLY: JSON.stringify(formerly),
      });
    });
}
