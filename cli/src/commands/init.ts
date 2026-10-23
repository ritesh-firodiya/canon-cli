import { basename, resolve } from "node:path";
import * as prompts from "@clack/prompts";
import type { Command } from "commander";
import { KINDS, MODULES, type Kind, type Module } from "../config/schema.ts";
import { applyInit, planInit, type InitPlan } from "../init.ts";
import { runCommand } from "../lib/system.ts";
import { zenoVersion } from "../status.ts";
import type { Env } from "./env.ts";

function cancelled<T>(value: T | symbol): value is symbol {
  if (!prompts.isCancel(value)) return false;
  prompts.cancel("Nothing written.");
  return true;
}

async function askAnswers(inferred: InitPlan): Promise<{ kind: Kind; modules: Module[] } | null> {
  const kind = await prompts.select({
    message: "What kind of product is this?",
    initialValue: inferred.config.kind,
    options: KINDS.map((value) => ({ value, label: value })),
  });
  if (cancelled(kind)) return null;
  const modules = await prompts.multiselect({
    message: "Which modules? (docs = wiki, design = HTML designs, knowledge = search, specs, metrics, code = LSP, architecture, listing)",
    initialValues: inferred.config.modules,
    options: MODULES.map((value) => ({ value, label: value })),
    required: false,
  });
  if (cancelled(modules)) return null;
  return { kind, modules };
}

export function registerInit(program: Command, env: Env): void {
  program
    .command("init")
    .description("set zeno up for a product: write .claude/zeno.yaml and the missing .context files")
    .argument("[repo]", "product repo", ".")
    .option("-y, --yes", "accept what zeno infers, no questions")
    .option("--force", "redo a repo that already has zeno.yaml")
    .action(async (repo: string, options: { yes?: boolean; force?: boolean }) => {
      const path = resolve(repo);
      const base = { zenoVersion: zenoVersion(env.zenoRoot), force: options.force };
      const inferred = planInit(path, base);
      const answers = options.yes ? null : await askAnswers(inferred);
      if (!options.yes && answers === null) return;
      const plan = answers ? planInit(path, { ...base, ...answers }) : inferred;

      applyInit(path, plan, { name: basename(path), run: (command, args) => void runCommand(command, args) });
      console.log(`wrote .claude/zeno.yaml (${plan.config.kind}: ${plan.config.modules.join(", ")})`);
      for (const file of plan.create) console.log(`created ${file}`);
      console.log("next: zeno check");
    });
}
