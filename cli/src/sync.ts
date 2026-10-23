import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { loadConfig } from "./config/load.ts";
import { fetchPackDocs, findPack, type CommandRunner } from "./packs.ts";
import { zenoVersion } from "./status.ts";

export interface SyncOptions {
  zenoRoot: string;
  estateRoot?: string;
  cacheDir: string;
  run: CommandRunner;
  fetchText: (url: string) => Promise<string>;
}

export interface SyncResult {
  packs: string[];
  version: { from: string | undefined; to: string } | null;
}

/** Refreshes a product's pack docs and search index, and moves its pinned zeno version to the current one. */
export async function syncRepo(repo: string, options: SyncOptions): Promise<SyncResult> {
  const file = join(repo, ".claude", "zeno.yaml");
  if (!existsSync(file)) throw new Error(`${repo} has no .claude/zeno.yaml — run \`zeno init\` first`);
  const { config } = loadConfig(repo, { estateRoot: options.estateRoot });

  const packs = config.packs;
  for (const name of packs) {
    await fetchPackDocs(findPack(options.zenoRoot, name), options);
  }
  options.run("qmd", ["update"]);
  options.run("qmd", ["embed"]);

  const current = zenoVersion(options.zenoRoot);
  if (config.zeno === current) return { packs, version: null };
  const document = parseDocument(readFileSync(file, "utf8"));
  document.set("zeno", current);
  writeFileSync(file, document.toString());
  return { packs, version: { from: config.zeno, to: current } };
}
