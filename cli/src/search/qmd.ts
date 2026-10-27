// qmd subprocess wrapper — the retrieval engine behind search and the site index.
import { spawnSync, type SpawnSyncOptions } from "node:child_process";

export interface QmdResult {
  ok: boolean;
  out: string;
  err: string;
}

export function qmd(args: string[], options: SpawnSyncOptions = {}): QmdResult {
  const result = spawnSync("qmd", args, { encoding: "utf8", ...options });
  return { ok: result.status === 0, out: String(result.stdout ?? ""), err: String(result.stderr ?? "") };
}

export function qmdQuery(query: string, collections: string[] = []): QmdResult {
  return qmd(["query", query, ...collections.flatMap((collection) => ["-c", collection])]);
}

export function qmdRefresh(): void {
  qmd(["update"]);
  qmd(["embed"]);
}
