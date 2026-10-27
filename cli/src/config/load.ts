import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { isStandardName, MODULES_BY_KIND, layerSchema, type Config, type CopyFileSpec, type Kind, type Layer, type Module } from "./schema.ts";

export interface ConfigSource {
  layer: "product" | "local";
  path: string;
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

/** The repo root plus each app in a monorepo's apps/ folder. */
function appRoots(repo: string): string[] {
  const apps = join(repo, "apps");
  if (!existsSync(apps)) return [repo];
  const children = readdirSync(apps, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  return [repo, ...children.map((entry) => join(apps, entry.name))];
}

/** A root package.json that ships a CLI or exports a library. */
function isPackage(repo: string): boolean {
  const file = join(repo, "package.json");
  if (!existsSync(file)) return false;
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  return Boolean(pkg.bin || pkg.exports || pkg.main) && !pkg.private;
}

export function inferKind(repo: string): Kind {
  const roots = appRoots(repo);
  const anyHas = (markers: string[]) => roots.some((root) => markers.some((file) => existsSync(join(root, file))));
  const mobile = anyHas(EXPO_MARKERS);
  const web = anyHas(WEB_MARKERS);
  if (mobile && web) return "mobile-and-web";
  if (mobile) return "mobile";
  if (web) return "web";
  return isPackage(repo) ? "package" : "content";
}

export function inferModules(repo: string, kind: Kind): Module[] {
  return withDesign(repo, MODULES_BY_KIND[kind]);
}

/** A repo that draws its screens always gets the design checks, even when its modules list leaves them out. */
function withDesign(repo: string, modules: Module[]): Module[] {
  const hasDesigns = existsSync(join(repo, ".context", "designs"));
  return hasDesigns && !modules.includes("design") ? [...modules, "design"] : modules;
}

/** The sets a source repo offers under its own copies.sets; none when the source is not checked out. */
function sourceSets(source: string | undefined, repo: string): Record<string, CopyFileSpec[]> {
  if (!source || resolve(source) === resolve(repo) || !existsSync(configPath(source))) return {};
  return readLayer(configPath(source)).copies?.sets ?? {};
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
 * Reads the repo's canon.yaml and its uncommitted canon.local.yaml over defaults
 * inferred from the repo. Scalars: the local layer wins. Lists of names add up
 * (packs, standards); lists of records merge by their key (commands, tools,
 * wiki types, context folders). Copy sets come from the source repo's canon.yaml.
 */
export function loadConfig(repo: string): { config: Config; sources: ConfigSource[] } {
  const candidates: ConfigSource[] = [
    { layer: "product", path: configPath(repo) },
    { layer: "local", path: join(repo, ".claude", "canon.local.yaml") },
  ];
  const sources = candidates.filter((source) => existsSync(source.path));
  const layers = sources.map((source) => ({ data: readLayer(source.path), base: dirname(dirname(source.path)) }));
  const pick = <K extends keyof Layer>(key: K) => layers.map((layer) => layer.data[key]);

  const kind = lastDefined(pick("kind")) ?? inferKind(repo);
  const source = lastDefined(layers.map((layer) => (layer.data.copies?.source ? resolve(layer.base, layer.data.copies.source) : undefined)));
  const config: Config = {
    canon: lastDefined(pick("canon")),
    kind,
    modules: withDesign(repo, lastDefined(pick("modules")) ?? MODULES_BY_KIND[kind]),
    expo: Object.assign({}, ...pick("expo")),
    packs: [...new Set(pick("packs").flatMap((packs) => packs ?? []))].sort(),
    standards: [...new Set(layers.flatMap((layer) => (layer.data.standards ?? []).map((entry) => (isStandardName(entry) ? entry : resolve(layer.base, entry)))))],
    commands: mergeBy(pick("commands").map((list) => list ?? []), (command) => command.id),
    doctor: { tools: mergeBy(pick("doctor").map((doctor) => doctor?.tools ?? []), (tool) => tool.tool) },
    weigh: { weights: Object.assign({}, ...pick("weigh").map((weigh) => weigh?.weights)) },
    wiki: { types: mergeBy(pick("wiki").map((wiki) => wiki?.types ?? []), (entry) => entry.type) },
    context: { folders: mergeBy(pick("context").map((context) => context?.folders ?? []), (entry) => entry.folder) },
    pipeline: lastDefined(pick("pipeline")) ?? [],
    name: lastDefined(pick("name")),
    formerly: [...new Set(pick("formerly").flatMap((names) => names ?? []))],
    copies: {
      source,
      sets: Object.assign({}, sourceSets(source, repo), ...pick("copies").map((copies) => copies?.sets)),
      use: [...new Set(pick("copies").flatMap((copies) => copies?.use ?? []))],
    },
  };
  if (config.name === undefined) delete config.name;
  if (Object.keys(config.expo ?? {}).length === 0) delete config.expo;
  return { config, sources };
}
