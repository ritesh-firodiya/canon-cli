import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { MODULES_BY_KIND, layerSchema, type Config, type Kind, type Layer, type Module } from "./schema.ts";

export interface ConfigSource {
  layer: "estate" | "product" | "local";
  path: string;
}

export interface LoadOptions {
  /** The estate folder; found by walking up from the repo when not given. */
  estateRoot?: string | null;
}

const EXPO_MARKERS = ["app.config.ts", "app.config.js", "app.json"];
const WEB_MARKERS = ["next.config.ts", "next.config.js", "next.config.mjs", "vite.config.ts"];

function configPath(folder: string): string {
  return join(folder, ".claude", "canon.yaml");
}

function readLayer(path: string): Layer {
  const parsed = layerSchema.safeParse(parse(readFileSync(path, "utf8")) ?? {});
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    throw new Error(`${path} is invalid:\n  ${problems.join("\n  ")}`);
  }
  return parsed.data;
}

/** The nearest folder at or above `start` whose canon.yaml says `estate: true`, or null. */
export function findEstate(start: string): string | null {
  let folder = resolve(start);
  while (true) {
    const path = configPath(folder);
    if (existsSync(path) && readLayer(path).estate === true) return folder;
    const parent = dirname(folder);
    if (parent === folder) return null;
    folder = parent;
  }
}

/** The repo root plus each app in a monorepo's apps/ folder. */
function appRoots(repo: string): string[] {
  const apps = join(repo, "apps");
  if (!existsSync(apps)) return [repo];
  const children = readdirSync(apps, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  return [repo, ...children.map((entry) => join(apps, entry.name))];
}

export function inferKind(repo: string): Kind {
  const roots = appRoots(repo);
  const anyHas = (markers: string[]) => roots.some((root) => markers.some((file) => existsSync(join(root, file))));
  if (anyHas(EXPO_MARKERS)) return "expo-app";
  if (anyHas(WEB_MARKERS)) return "web";
  return "content";
}

export function inferModules(repo: string, kind: Kind): Module[] {
  const modules = MODULES_BY_KIND[kind];
  const hasDesigns = existsSync(join(repo, ".context", "designs"));
  return hasDesigns && !modules.includes("design") ? [...modules, "design"] : modules;
}

function lastDefined<T>(values: Array<T | undefined>): T | undefined {
  return values.filter((value) => value !== undefined).pop();
}

function mergeBy<T>(lists: T[][], key: (item: T) => string): T[] {
  const merged = new Map<string, T>();
  for (const item of lists.flat()) merged.set(key(item), item);
  return [...merged.values()];
}

/**
 * Reads the estate, product and local canon.yaml layers over defaults inferred
 * from the repo. Scalars: the most specific layer wins. Lists of names add up
 * (packs, standards); lists of records merge by their key (commands, tools,
 * wiki types, context folders).
 */
export function loadConfig(repo: string, options: LoadOptions = {}): { config: Config; sources: ConfigSource[] } {
  const estateRoot = options.estateRoot === undefined ? findEstate(dirname(resolve(repo))) : options.estateRoot;
  const candidates: ConfigSource[] = [
    ...(estateRoot && resolve(estateRoot) !== resolve(repo) ? [{ layer: "estate" as const, path: configPath(estateRoot) }] : []),
    { layer: "product", path: configPath(repo) },
    { layer: "local", path: join(repo, ".claude", "canon.local.yaml") },
  ];
  const sources = candidates.filter((source) => existsSync(source.path));
  const layers = sources.map((source) => ({ data: readLayer(source.path), base: dirname(dirname(source.path)) }));
  const pick = <K extends keyof Layer>(key: K) => layers.map((layer) => layer.data[key]);

  const kind = lastDefined(pick("kind")) ?? inferKind(repo);
  const config: Config = {
    canon: lastDefined(pick("canon")),
    kind,
    modules: lastDefined(pick("modules")) ?? inferModules(repo, kind),
    expo: Object.assign({}, ...pick("expo")),
    packs: [...new Set(pick("packs").flatMap((packs) => packs ?? []))].sort(),
    standards: [...new Set(layers.flatMap((layer) => (layer.data.standards ?? []).map((dir) => resolve(layer.base, dir))))],
    commands: mergeBy(pick("commands").map((list) => list ?? []), (command) => command.id),
    doctor: { tools: mergeBy(pick("doctor").map((doctor) => doctor?.tools ?? []), (tool) => tool.tool) },
    weigh: { weights: Object.assign({}, ...pick("weigh").map((weigh) => weigh?.weights)) },
    wiki: { types: mergeBy(pick("wiki").map((wiki) => wiki?.types ?? []), (entry) => entry.type) },
    context: { folders: mergeBy(pick("context").map((context) => context?.folders ?? []), (entry) => entry.folder) },
    pipeline: lastDefined(pick("pipeline")) ?? [],
    name: lastDefined(pick("name")),
    copies: {
      source: lastDefined(layers.map((layer) => (layer.data.copies?.source ? resolve(layer.base, layer.data.copies.source) : undefined))),
      sets: Object.assign({}, ...pick("copies").map((copies) => copies?.sets)),
      use: [...new Set(pick("copies").flatMap((copies) => copies?.use ?? []))],
    },
  };
  if (config.name === undefined) delete config.name;
  if (Object.keys(config.expo ?? {}).length === 0) delete config.expo;
  return { config, sources };
}
