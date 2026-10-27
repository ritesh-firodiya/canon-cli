import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { Config, CopyFileSpec } from "../config/schema.ts";
import { loadConfig } from "../config/load.ts";
import type { Check, Finding } from "./types.ts";

// zeno init writes the README heading `# .context — <Name>`; a product without a `name:` is read from it.
const README_NAME = /^# \.context — (.+)$/m;

export interface Pair {
  set: string;
  from: string;
  to: string;
  named: boolean;
  until?: string;
}

const pairOf = (set: string, file: CopyFileSpec): Pair =>
  typeof file === "string" ? { set, from: file, to: file, named: false } : { set, from: file.from, to: file.to ?? file.from, named: file.named ?? false, until: file.until };

/** Every file of every set the product uses, as source → product paths. */
export function usedCopies(config: Config): Pair[] {
  return config.copies.use.flatMap((set) => (config.copies.sets[set] ?? []).map((file) => pairOf(set, file)));
}

function nameOf(repo: string, config: Config): string | undefined {
  if (config.name) return config.name;
  const readme = join(repo, ".context", "README.md");
  return existsSync(readme) ? README_NAME.exec(readFileSync(readme, "utf8"))?.[1]?.trim() : undefined;
}

function split(text: string, marker: string): { shared: string; own: string } | null {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => line.includes(marker));
  return at === -1 ? null : { shared: lines.slice(0, at).join("\n"), own: lines.slice(at).join("\n") };
}

export interface CopyState {
  pair: Pair;
  state: "same" | "drift" | "missing" | "unknown-set" | "no-source" | "unnamed";
  /** What the product file should hold; set for a drift --sync can repair. */
  want?: string;
}

/** Compares every file of every set the product uses with the source repo. */
export function compareCopies(repo: string, config: Config): CopyState[] {
  const { source, sets, use } = config.copies;
  if (use.length === 0 || !source || resolve(source) === resolve(repo)) return [];
  const unknown = use.filter((set) => !sets[set]).map((set): CopyState => ({ pair: { set, from: "", to: "", named: false }, state: "unknown-set" }));
  const productName = nameOf(repo, config);
  const sourceName = nameOf(source, loadConfig(source).config);

  return [
    ...unknown,
    ...usedCopies(config).map((pair): CopyState => {
      const from = join(source, pair.from);
      const to = join(repo, pair.to);
      if (!existsSync(from)) return { pair, state: "no-source" };
      if (!existsSync(to)) return { pair, state: "missing" };
      if (pair.named && (!productName || !sourceName)) return { pair, state: "unnamed" };
      const original = pair.named ? readFileSync(from, "utf8").replaceAll(sourceName!, productName!) : readFileSync(from, "utf8");
      const current = readFileSync(to, "utf8");
      if (!pair.until) return original === current ? { pair, state: "same" } : { pair, state: "drift", want: original };
      const theirs = split(original, pair.until);
      const ours = split(current, pair.until);
      if (theirs && ours && theirs.shared === ours.shared) return { pair, state: "same" };
      // Without the marker the product's own part cannot be told from the shared one, so nothing is written.
      return { pair, state: "drift", want: theirs && ours ? `${theirs.shared}\n${ours.own}` : undefined };
    }),
  ];
}

/** Overwrites each drifted copy with the source's. Never adds a missing file. Returns the paths written. */
export function syncCopies(repo: string, config: Config): string[] {
  return compareCopies(repo, config).flatMap(({ pair, state, want }) => {
    if (state !== "drift" || want === undefined) return [];
    writeFileSync(join(repo, pair.to), want);
    return [pair.to];
  });
}

export const sharedFiles: Check = {
  id: "shared-files",
  module: null,
  description: "every file of every copies set the product uses exists and matches copies.source",
  run({ repo, config }) {
    const source = config.copies.source ? basename(config.copies.source) : "copies.source";
    return compareCopies(repo, config).flatMap(({ pair, state }): Finding[] => {
      const finding = (file: string, message: string): Finding[] => [{ check: "shared-files", level: "error", file, message }];
      if (state === "unknown-set") return finding(".claude/zeno.yaml", `copies.use names ${pair.set}, which no copies.sets defines`);
      if (state === "no-source") return finding(pair.to, `${source} has no ${pair.from} (set ${pair.set})`);
      if (state === "missing") return finding(pair.to, `missing — set ${pair.set} is in use; copy it from ${source}`);
      if (state === "unnamed") return finding(pair.to, "no product name to compare with — set name: in zeno.yaml");
      if (state === "drift") return finding(pair.to, `differs from ${source}${pair.until ? " above the shared block's end" : ""} — \`zeno copies --sync\` copies it`);
      return [];
    });
  },
};
