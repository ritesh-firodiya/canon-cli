import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { Config, CopyFileSpec } from "../config/schema.ts";
import { loadConfig } from "../config/load.ts";
import type { Check, Finding } from "./types.ts";

// zeno init writes the README heading `# .context — <Name>`; a product without a `name:` is read from it.
const README_NAME = /^# \.context — (.+)$/m;

interface Pair {
  from: string;
  to: string;
  /** A plain path: the product must carry it or skip it with a reason. */
  required: boolean;
  named: boolean;
  until?: string;
}

function pairsOf(file: CopyFileSpec): Pair[] {
  if (typeof file === "string") return [{ from: file, to: file, required: true, named: false }];
  return (file.to ?? [file.from]).map((to) => ({ from: file.from, to, required: false, named: file.named ?? false, until: file.until }));
}

function nameOf(repo: string, config: Config): string | undefined {
  if (config.name) return config.name;
  const readme = join(repo, ".context", "README.md");
  return existsSync(readme) ? README_NAME.exec(readFileSync(readme, "utf8"))?.[1]?.trim() : undefined;
}

function above(text: string, marker: string): string {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => line.includes(marker));
  return (at === -1 ? lines : lines.slice(0, at)).join("\n");
}

function below(text: string, marker: string): string {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => line.includes(marker));
  return at === -1 ? "" : lines.slice(at).join("\n");
}

export interface CopyState {
  pair: Pair;
  state: "same" | "drift" | "missing" | "unnamed";
  /** What the product file should hold; set for drift. */
  want?: string;
}

/** Compares every shared file of `repo` with the source repo. Skipped files and files absent from the source are left out. */
export function compareCopies(repo: string, config: Config): CopyState[] {
  const { source, files, skip } = config.copies;
  if (!source || files.length === 0 || resolve(source) === resolve(repo)) return [];
  const skipped = new Set(skip.map((entry) => entry.file));
  const productName = nameOf(repo, config);
  const sourceName = nameOf(source, loadConfig(source).config);
  const states: CopyState[] = [];

  for (const pair of files.flatMap(pairsOf)) {
    const from = join(source, pair.from);
    const to = join(repo, pair.to);
    if (skipped.has(pair.to) || !existsSync(from)) continue;
    if (!existsSync(to)) {
      if (pair.required) states.push({ pair, state: "missing" });
      continue;
    }
    if (pair.named && (!productName || !sourceName)) {
      states.push({ pair, state: "unnamed" });
      continue;
    }
    const original = readFileSync(from, "utf8");
    const current = readFileSync(to, "utf8");
    let want = pair.named ? original.replaceAll(sourceName!, productName!) : original;
    let have = current;
    if (pair.until) {
      want = above(want, pair.until);
      have = above(current, pair.until);
    }
    if (want === have) states.push({ pair, state: "same" });
    // Without the marker the product's own part cannot be told from the shared one, so nothing is written.
    else if (pair.until && !current.includes(pair.until)) states.push({ pair, state: "drift" });
    else states.push({ pair, state: "drift", want: pair.until ? `${want}\n${below(current, pair.until)}` : want });
  }
  return states;
}

/** Overwrites each drifted copy with the source's. Never adds a missing file. Returns the paths written. */
export function syncCopies(repo: string, config: Config): string[] {
  const written: string[] = [];
  for (const { pair, state, want } of compareCopies(repo, config)) {
    if (state !== "drift" || want === undefined) continue;
    writeFileSync(join(repo, pair.to), want);
    written.push(pair.to);
  }
  return written;
}

export const sharedFiles: Check = {
  id: "shared-files",
  module: null,
  description: "files copied from the copies.source repo are identical to it; one a product does without is skipped with a reason",
  run({ repo, config }) {
    const source = config.copies.source ? basename(config.copies.source) : "";
    return compareCopies(repo, config).flatMap(({ pair, state }): Finding[] => {
      const finding = (message: string): Finding[] => [{ check: "shared-files", level: "error", file: pair.to, message }];
      if (state === "missing") return finding(`missing — copy it from ${source}, or add it under copies.skip with a reason`);
      if (state === "unnamed") return finding(`no product name to compare with — set name: in zeno.yaml`);
      if (state === "drift") return finding(`differs from ${source}${pair.until ? " above the shared block's end" : ""} — \`zeno copies --sync\` copies it`);
      return [];
    });
  },
};
