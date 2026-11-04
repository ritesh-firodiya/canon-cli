import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { loadConfig } from "../../config/load.ts";
import { CONFIG_FILE } from "../../config/schema.ts";
import { indexKnowledge, refreshArchitectureBase } from "../../setup/init/init.ts";
import { fetchPackDocs, findPack, type CommandRunner } from "../packs/packs.ts";
import { canonVersion } from "../../enforce/status/status.ts";

export interface SyncOptions {
  canonRoot: string;
  cacheDir: string;
  run: CommandRunner;
  fetchText: (url: string) => Promise<string>;
}

export interface SyncResult {
  packs: string[];
  /** True when the managed architecture base was rewritten from canon's template. */
  base: boolean;
  version: { from: string | undefined; to: string } | null;
}

/** Changes only the version line: a person's formatting elsewhere in the file is theirs. */
function withVersion(text: string, version: string): string {
  const line = `canon: ${version}`;
  return /^canon:.*$/m.test(text) ? text.replace(/^canon:.*$/m, line) : `${text.replace(/\n?$/, "\n")}${line}\n`;
}

/** Refreshes a product's pack docs and search index, and moves its pinned canon version to the current one. */
export async function syncRepo(repo: string, options: SyncOptions): Promise<SyncResult> {
  const file = join(repo, CONFIG_FILE);
  if (!existsSync(file)) throw new Error(`${repo} has no .context/context.yaml — run \`canon init\` first`);
  const { config } = loadConfig(repo);

  const packs = config.packs;
  for (const name of packs) {
    await fetchPackDocs(findPack(options.canonRoot, name), options);
  }
  if (config.modules.includes("knowledge")) indexKnowledge(repo, basename(repo), options.run);
  options.run("qmd", ["update"]);
  options.run("qmd", ["embed"]);

  const base = refreshArchitectureBase(repo, options.canonRoot);
  const current = canonVersion(options.canonRoot);
  if (config.canon === current) return { packs, base, version: null };
  writeFileSync(file, withVersion(readFileSync(file, "utf8"), current));
  return { packs, base, version: { from: config.canon, to: current } };
}
