#!/usr/bin/env node
import { resolve } from "node:path";
import { Command } from "commander";
import { registerAdd } from "./commands/add.ts";
import { registerApprove } from "./commands/approve.ts";
import { registerCheck } from "./commands/check.ts";
import { registerCopies } from "./commands/copies.ts";
import { registerDoctor } from "./commands/doctor.ts";
import { registerHooks } from "./commands/hooks.ts";
import type { Env } from "./commands/env.ts";
import { registerInit } from "./commands/init.ts";
import { registerLearn } from "./commands/learn.ts";
import { registerStandards } from "./commands/standards.ts";
import { registerStatus } from "./commands/status.ts";
import { registerSync } from "./commands/sync.ts";
import { registerUi } from "./commands/ui.ts";
import { registerWeigh } from "./commands/weigh.ts";
import { findEstate } from "./config/load.ts";
import { zenoVersion } from "./status.ts";

const env: Env = {
  zenoRoot: resolve(import.meta.dirname, "..", ".."),
  estateRoot: process.env.ZENO_ESTATE ?? findEstate(process.cwd()),
};

const program = new Command("zeno")
  .description("Shared standards, knowledge and decision checks for every product.")
  .version(zenoVersion(env.zenoRoot));

registerInit(program, env);
registerAdd(program, env);
registerCheck(program, env);
registerCopies(program, env);
registerSync(program, env);
registerStatus(program, env);
registerStandards(program, env);
registerDoctor(program);
registerHooks(program, env);
registerUi(program, env);
registerLearn(program, env);
registerApprove(program);
registerWeigh(program);

program.parseAsync().catch((error: Error) => {
  console.error(`zeno: ${error.message}`);
  process.exitCode = 1;
});
