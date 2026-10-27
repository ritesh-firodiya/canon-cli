import { resolve } from "node:path";
import type { Command } from "commander";
import { CACHE_DIR, fetchText, runCommand } from "../lib/system.ts";
import { addPack, fetchPackDocs, findPack, listPacks } from "../packs.ts";
import { requireEstate, type Env } from "./env.ts";

export function registerAdd(program: Command, env: Env): void {
  program
    .command("add")
    .description("add a knowledge pack (rules + vendor docs in search), e.g. canon add expo")
    .argument("[pack]", "pack name; omit to list packs")
    .option("-g, --global", "add for every product (estate canon.yaml)")
    .option("--repo <repo>", "product repo", ".")
    .action(async (name: string | undefined, options: { global?: boolean; repo: string }) => {
      if (!name) {
        for (const pack of listPacks(env.canonRoot)) console.log(`${pack.name.padEnd(11)} ${pack.description}`);
        return;
      }
      const estateRoot = options.global ? requireEstate(env) : undefined;
      const { file, added } = addPack(resolve(options.repo), name, { canonRoot: env.canonRoot, global: options.global, estateRoot });
      console.log(added ? `added ${name} to ${file}` : `${name} already in ${file}`);
      const dir = await fetchPackDocs(findPack(env.canonRoot, name), { cacheDir: CACHE_DIR, fetchText, run: runCommand });
      console.log(`indexed ${dir} as qmd://pack-${name}`);
    });
}
