import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse, parseDocument } from "yaml";
import { z } from "zod";
import { CONFIG_FILE, KINDS } from "../config/schema.ts";

const packSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9-]+$/),
    description: z.string(),
    kinds: z.array(z.enum(KINDS)),
    skill: z.string().optional(),
    docs: z.array(z.url()),
  })
  .strict();

export type Pack = z.infer<typeof packSchema>;

export interface RunResult {
  status: number;
  output: string;
}
export type CommandRunner = (command: string, args: string[]) => RunResult;

export function listPacks(canonRoot: string): Pack[] {
  const root = join(canonRoot, "packs");
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "pack.yaml")))
    .map((entry) => {
      const pack = packSchema.parse(parse(readFileSync(join(root, entry.name, "pack.yaml"), "utf8")));
      if (pack.name !== entry.name) throw new Error(`packs/${entry.name}/pack.yaml is named "${pack.name}"`);
      return pack;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function findPack(canonRoot: string, name: string): Pack {
  const packs = listPacks(canonRoot);
  const pack = packs.find((candidate) => candidate.name === name);
  if (!pack) throw new Error(`no pack "${name}" — available: ${packs.map((p) => p.name).join(", ")}`);
  return pack;
}

interface AddOptions {
  canonRoot: string;
}

/** Records a pack in the repo's context.yaml, keeping the file's comments and other keys. */
export function addPack(repo: string, name: string, options: AddOptions): { file: string; added: boolean } {
  findPack(options.canonRoot, name);
  const file = join(repo, CONFIG_FILE);
  if (!existsSync(file)) throw new Error(`${repo} has no .context/context.yaml — run \`canon init\` first`);

  const document = parseDocument(readFileSync(file, "utf8"));
  const current = (document.get("packs") as { toJSON(): string[] } | undefined)?.toJSON() ?? [];
  if (current.includes(name)) return { file, added: false };
  document.set("packs", [...current, name]);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, document.toString());
  return { file, added: true };
}

interface FetchOptions {
  cacheDir: string;
  fetchText: (url: string) => Promise<string>;
  run: CommandRunner;
}

function docFileName(url: string): string {
  const { hostname, pathname } = new URL(url);
  const stem = pathname.split("/").filter(Boolean).pop()?.replace(/\.[a-z]+$/, "") ?? "index";
  return `${hostname}-${stem}.md`;
}

/** Downloads a pack's vendor docs into the cache as Markdown and indexes them in QMD as `pack-<name>`. */
export async function fetchPackDocs(pack: Pack, options: FetchOptions): Promise<string> {
  const dir = join(options.cacheDir, "packs", pack.name);
  mkdirSync(dir, { recursive: true });
  for (const url of pack.docs) {
    let text: string;
    try {
      text = await options.fetchText(url);
    } catch (error) {
      throw new Error(`could not download ${url}: ${(error as Error).message}`);
    }
    writeFileSync(join(dir, docFileName(url)), text);
  }

  const collection = `pack-${pack.name}`;
  const added = options.run("qmd", ["collection", "add", dir, "--name", collection]);
  if (added.status === 0) {
    options.run("qmd", ["context", "add", `qmd://${collection}`, `${pack.description.split(" — ")[0]} — vendor docs index (${pack.name} pack)`]);
  } else if (/already exists/i.test(added.output)) {
    options.run("qmd", ["update"]);
  } else {
    throw new Error(`qmd could not index ${dir}: ${added.output.trim()}`);
  }
  return dir;
}
