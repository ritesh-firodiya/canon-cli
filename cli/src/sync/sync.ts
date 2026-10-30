import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseDocument } from "yaml";
import { loadConfig } from "../config/load.ts";
import { indexKnowledge, refreshArchitectureBase } from "../init/init.ts";
import { fetchPackDocs, findPack, type CommandRunner } from "../packs/packs.ts";
import { canonVersion } from "../status/status.ts";

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

/** Refreshes a product's pack docs and search index, and moves its pinned canon version to the current one. */
export async function syncRepo(repo: string, options: SyncOptions): Promise<SyncResult> {
  const file = join(repo, ".claude", "canon.yaml");
  if (!existsSync(file)) throw new Error(`${repo} has no .claude/canon.yaml — run \`canon init\` first`);
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
  const document = parseDocument(readFileSync(file, "utf8"));
  document.set("canon", current);
  writeFileSync(file, document.toString());
  return { packs, base, version: { from: config.canon, to: current } };
}
