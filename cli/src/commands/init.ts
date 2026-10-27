import { basename, resolve } from "node:path";
import * as prompts from "@clack/prompts";
import { Option, type Command } from "commander";
import { KINDS, MODULES, type Kind } from "../config/schema.ts";
import { RULES_FILES } from "../checks/architecture.ts";
import { applyInit, parseChoices, planInit, type InitAnswers, type InitPlan } from "../init.ts";
import { listPacks, type Pack } from "../packs.ts";
import { runCommand } from "../lib/system.ts";
import { canonVersion } from "../status.ts";
import type { Env } from "../lib/env.ts";

function cancelled<T>(value: T | symbol): value is symbol {
  if (!prompts.isCancel(value)) return false;
  prompts.cancel("Nothing written.");
  return true;
}

type Choices = Required<Pick<InitAnswers, "kind" | "modules" | "packs">>;

async function askAnswers(inferred: InitPlan, packs: Pack[]): Promise<Choices | null> {
  const kind = await prompts.select({
    message: "What kind of product is this?",
    initialValue: inferred.config.kind,
    options: KINDS.map((value) => ({ value, label: value })),
  });
  if (cancelled(kind)) return null;
  const modules = await prompts.multiselect({
    message: "Which modules? All optional. (docs = wiki, design = HTML designs, knowledge = search, metrics = definitions.yml, code = LSP, architecture, listing)",
    initialValues: inferred.config.modules,
    options: MODULES.map((value) => ({ value, label: value })),
    required: false,
  });
  if (cancelled(modules)) return null;
  const forKind = packs.filter((pack) => pack.kinds.includes(kind));
  if (forKind.length === 0) return { kind, modules, packs: [] };
  const chosen = await prompts.multiselect({
    message: "Which vendor doc packs? (indexed for search on `canon sync`)",
    initialValues: inferred.config.packs ?? [],
    options: forKind.map((pack) => ({ value: pack.name, label: pack.name, hint: pack.description })),
    required: false,
  });
  if (cancelled(chosen)) return null;
  return { kind, modules, packs: chosen };
}

interface InitOptions {
  yes?: boolean;
  force?: boolean;
  kind?: Kind;
  modules?: string;
  packs?: string;
}

export function registerInit(program: Command, env: Env): void {
  program
    .command("init")
    .description("set canon up for a product: write .claude/canon.yaml and the missing .context files")
    .argument("[repo]", "product repo", ".")
    .option("-y, --yes", "accept what canon infers (and any flags below), no questions")
    .addOption(new Option("--kind <kind>", "product kind").choices(KINDS))
    .option("--modules <list>", `comma list, empty for none: ${MODULES.join(", ")}`)
    .option("--packs <list>", "comma list of vendor doc packs (see `canon add`)")
    .option("--force", "redo a repo that already has canon.yaml")
    .action(async (repo: string, options: InitOptions) => {
      const path = resolve(repo);
      const packs = listPacks(env.canonRoot);
      const flags: InitAnswers = {
        canonVersion: canonVersion(env.canonRoot),
        force: options.force,
        kind: options.kind,
        modules: options.modules === undefined ? undefined : parseChoices(options.modules, MODULES, "module"),
        packs: options.packs === undefined ? undefined : parseChoices(options.packs, packs.map((p) => p.name), "pack"),
      };
      const inferred = planInit(path, flags);
      const answers = options.yes ? null : await askAnswers(inferred, packs);
      if (!options.yes && answers === null) return;
      const plan = answers ? planInit(path, { ...flags, ...answers }) : inferred;

      applyInit(path, plan, { name: basename(path), canonRoot: env.canonRoot, run: (command, args) => void runCommand(command, args) });
      console.log(`wrote .claude/canon.yaml (${plan.config.kind}: ${plan.config.modules.join(", ")})`);
      for (const file of plan.create) console.log(`created ${file}`);
      if (plan.create.some((file) => file.endsWith(RULES_FILES[0]))) console.log("architecture: add the checker with `pnpm add -D dependency-cruiser`, then edit the .dependency-cruiser.cjs files to this repo's layers");
      console.log(plan.config.packs ? "next: canon sync (fetches the packs), then canon check" : "next: canon check");
    });
}
