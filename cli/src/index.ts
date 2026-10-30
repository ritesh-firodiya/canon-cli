#!/usr/bin/env node
import { resolve } from "node:path";
import { Command } from "commander";
import { registerAdd } from "./packs/add.command.ts";
import { registerApprove } from "./pipeline/approve.command.ts";
import { registerCheck } from "./check/check.command.ts";
import { registerCopies } from "./check/copies.command.ts";
import { registerDoctor } from "./doctor/doctor.command.ts";
import { registerHooks } from "./check/hooks.command.ts";
import type { Env } from "./lib/env.ts";
import { registerInit } from "./init/init.command.ts";
import { registerLearn } from "./learn/learn.command.ts";
import { registerPipeline } from "./pipeline/pipeline.command.ts";
import { registerStandards } from "./standards/standards.command.ts";
import { registerStatus } from "./status/status.command.ts";
import { registerSync } from "./sync/sync.command.ts";
import { registerUpdate } from "./update/update.command.ts";
import { registerUi } from "./ui/ui.command.ts";
import { registerWiki } from "./wiki/wiki.command.ts";
import { registerWeigh } from "./weigh/weigh.command.ts";
import { findWorkspace } from "./check/check.ts";
import { registerMcp } from "./search/mcp.command.ts";
import { registerSearch } from "./search/search.command.ts";
import { registerFlow } from "./flow/flow.command.ts";
import { canonVersion } from "./status/status.ts";

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
registerCopies(program, env);
registerSync(program, env);
registerUpdate(program, env);
registerStatus(program, env);
registerStandards(program, env);
registerDoctor(program);
registerHooks(program, env);
registerUi(program, env);
registerWiki(program, env);
registerLearn(program, env);
registerApprove(program);
registerPipeline(program, env);
registerWeigh(program);
registerFlow(program, env);

registerSearch(program);
registerMcp(program);

program.parseAsync().catch((error: Error) => {
  console.error(`canon: ${error.message}`);
  process.exitCode = 1;
});
