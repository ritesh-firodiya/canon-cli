#!/usr/bin/env node
import { resolve } from "node:path";
import { Command } from "commander";
import { registerAdd } from "./know/packs/add.command.ts";
import { registerApprove } from "./work/pipeline/approve.command.ts";
import { registerCheck } from "./enforce/checks/check.command.ts";
import { registerDoctor } from "./setup/doctor/doctor.command.ts";
import { registerHooks } from "./enforce/checks/hooks.command.ts";
import type { Env } from "./lib/env.ts";
import { registerInit } from "./setup/init/init.command.ts";
import { registerLearn } from "./learn/learn/learn.command.ts";
import { registerPipeline } from "./work/pipeline/pipeline.command.ts";
import { registerRecords } from "./work/records/records.command.ts";
import { registerRun } from "./work/run/run.command.ts";
import { registerUpdate } from "./setup/update/update.command.ts";
import { registerUi } from "./serve/ui/ui.command.ts";
import { registerWiki } from "./serve/wiki/wiki.command.ts";
import { findWorkspace } from "./enforce/checks/check.ts";
import { registerFlow } from "./learn/flow/flow.command.ts";
import { registerModels } from "./setup/models/models.command.ts";
import { registerUsage } from "./learn/usage/usage.command.ts";
import { registerBand } from "./serve/band/band.command.ts";
import { registerWork } from "./work/work/work.command.ts";
import { registerFeatures } from "./setup/features/features.command.ts";
import { canonVersion } from "./enforce/status/status.ts";
import { registerMoved } from "./lib/moved.ts";

const env: Env = {
  canonRoot: resolve(import.meta.dirname, "..", ".."),
  workspace: process.env.CANON_WORKSPACE ?? findWorkspace(process.cwd()),
};

const program = new Command("canon")
  .description("Shared standards, knowledge and decision checks for every product.")
  .version(canonVersion(env.canonRoot));

registerInit(program, env);
registerAdd(program, env);
registerCheck(program, env);
registerUpdate(program, env);
registerDoctor(program);
registerHooks(program, env);
registerUi(program, env);
registerWiki(program, env);
registerLearn(program, env);
registerApprove(program);
registerPipeline(program, env);
registerRecords(program);
registerRun(program);
registerFlow(program, env);
registerUsage(program, env);
registerModels(program);
registerBand(program, env);
registerWork(program);
registerFeatures(program);
registerMoved(program);

program.parseAsync().catch((error: Error) => {
  console.error(`canon: ${error.message}`);
  process.exitCode = 1;
});
