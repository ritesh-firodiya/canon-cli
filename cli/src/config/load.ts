import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { DEFAULT_PIPELINE } from "./default-pipeline.ts";
import { CONFIG_FILE, isStandardName, LOCAL_CONFIG_FILE, MODULES_BY_KIND, layerSchema, type Config, type CopyFileSpec, type Kind, type Layer, type Module, DEFAULT_PRIORITIES, DEFAULT_RECORDS, type RecordEntry, type StageEntry, type StageSpec, type RecordKind } from "./schema.ts";

export interface ConfigSource {
  layer: "extends" | "product" | "local";
  path: string;
}

const EXPO_MARKERS = ["app.config.ts", "app.config.js", "app.json"];
const WEB_MARKERS = ["next.config.ts", "next.config.js", "next.config.mjs", "vite.config.ts"];

function configPath(folder: string): string {
  return join(folder, CONFIG_FILE);
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
/** Everything a layer builds on, furthest first. Paths are relative to the file naming them. */
function extendedFiles(path: string, seen: string[] = []): string[] {
  if (seen.includes(path)) throw new Error(`extends goes in a circle at ${path}`);
  return (readLayer(path).extends ?? []).flatMap((entry) => {
    const parent = resolve(dirname(path), entry);
    if (!existsSync(parent)) throw new Error(`${path} extends ${entry}, which does not exist`);
    return [...extendedFiles(parent, [...seen, path]), parent];
  });
}

/** A value by its dotted path; a list is searched by each item's `id` or `folder`. */
export function valueAt(root: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((value, part) => {
    if (Array.isArray(value)) return value.find((item) => item?.id === part || item?.folder === part);
    return value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined;
  }, root);
}

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

/** The default record kinds with a repo's changes applied. A new kind must say its prefix and statuses. */
function resolveRecords(changes: RecordEntry[]): RecordKind[] {
  const removed = new Set(changes.filter((entry) => entry.remove).map((entry) => entry.folder));
  const kinds = changes.filter((entry) => !entry.remove);
  const changedDefaults = DEFAULT_RECORDS.filter((kind) => !removed.has(kind.folder)).map((kind) => {
    const entry = kinds.find((item) => item.folder === kind.folder);
    if (!entry) return kind;
    const statuses = entry.statuses ?? kind.statuses;
    // A default's words for a status the repo dropped go with it.
    const inherited = { ...kind.meanings, status: Object.fromEntries(Object.entries(kind.meanings.status ?? {}).filter(([status]) => statuses.includes(status))) };
    const { fields, removedFields } = splitFields(kind.fields, entry);
    return { ...kind, ...entry, fields, removed: removedFields, closed: entry.closed ?? kind.closed.filter((status) => statuses.includes(status)), meanings: mergeMeanings(inherited, entry.meanings) };
  });
  const added = kinds
    .filter((entry) => !DEFAULT_RECORDS.some((kind) => kind.folder === entry.folder))
    .map((entry): RecordKind => {
      if ((!entry.prefix && !entry.named) || !entry.statuses) throw new Error(`records: ${entry.folder} is new, so it needs a prefix (or named: true) and statuses`);
      const { fields, removedFields } = splitFields({}, entry);
      return { ...entry, prefix: entry.prefix ?? "", statuses: entry.statuses, closed: entry.closed ?? [], meanings: entry.meanings ?? {}, fields, removed: removedFields, required: entry.required ?? [], sections: entry.sections ?? [] };
    });
  const records = [...changedDefaults, ...added];
  for (const kind of records) {
    const unknown = Object.keys(kind.meanings.status ?? {}).concat(kind.closed).filter((status) => !kind.statuses.includes(status));
    if (unknown.length) throw new Error(`records: ${kind.folder} has no status ${unknown.join(", ")}`);
    const impossible = kind.required.filter((field) => kind.removed.includes(field));
    if (impossible.length) throw new Error(`records: ${kind.folder} both requires and removes ${impossible.join(", ")}`);
  }
  const prefixes = records.map((kind) => kind.prefix).filter(Boolean);
  const repeated = prefixes.find((prefix, index) => prefixes.indexOf(prefix) !== index);
  if (repeated) throw new Error(`records: two kinds use the prefix ${repeated}`);
  return records;
}

function splitFields(base: RecordKind["fields"], entry: RecordEntry): { fields: RecordKind["fields"]; removedFields: string[] } {
  const merged = { ...base, ...entry.fields };
  const removedFields = Object.keys(merged).filter((field) => merged[field] === "remove");
  return { fields: Object.fromEntries(Object.entries(merged).filter(([, rule]) => rule !== "remove")) as RecordKind["fields"], removedFields };
}

function mergeMeanings(base: RecordKind["meanings"], extra: RecordKind["meanings"] = {}): RecordKind["meanings"] {
  return Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(extra)])].map((field) => [field, { ...base[field], ...extra[field] }]));
}

/** An entry naming a default stage inherits what it does not set, so one flow keeps one wording. */
function resolvePipelines(pipelines: Record<string, StageEntry[]>): Record<string, StageSpec[]> {
  const resolved = Object.entries(pipelines).map(([name, stages]) => [
    name,
    stages.map((stage): StageSpec => {
      const inherited = DEFAULT_PIPELINE.find((entry) => entry.id === stage.id);
      return { ...inherited, ...stage, done: stage.done ?? inherited?.done ?? [], gate: stage.gate ?? inherited?.gate ?? false };
    }),
  ]);
  return { default: DEFAULT_PIPELINE, ...Object.fromEntries(resolved) };
}

function mergeBy<T>(lists: T[][], key: (item: T) => string): T[] {
  const merged = new Map<string, T>();
  for (const item of lists.flat()) merged.set(key(item), item);
  return [...merged.values()];
}

/**
 * Reads the repo's context.yaml and its uncommitted context.local.yaml over defaults
 * inferred from the repo. Scalars: the local layer wins. Lists of names add up
 * (packs, standards); lists of records merge by their key (commands, tools,
 * wiki types, context folders). Copy sets come from the source repo's context.yaml.
 */
export function loadConfig(repo: string): { config: Config; sources: ConfigSource[] } {
  const candidates: ConfigSource[] = [
    { layer: "product", path: configPath(repo) },
    { layer: "local", path: join(repo, LOCAL_CONFIG_FILE) },
  ];
  const own = candidates.filter((source) => existsSync(source.path));
  const inherited = [...new Set(own.flatMap((source) => extendedFiles(source.path)))].map((path): ConfigSource => ({ layer: "extends", path }));
  const sources = [...inherited, ...own];
  const layers = sources.map((source) => ({ path: source.path, data: readLayer(source.path), base: source.layer === "extends" ? dirname(source.path) : dirname(dirname(source.path)) }));
  const inheritedLayers = layers.slice(0, inherited.length);
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
    pipelines: resolvePipelines(Object.assign({}, ...pick("pipelines"))),
    baseline: { pipelines: resolvePipelines(Object.assign({}, ...inheritedLayers.map((layer) => layer.data.pipelines))), cap: lastDefined(inheritedLayers.map((layer) => layer.data.cap)) },
    locks: layers.flatMap((layer) => (layer.data.locked ?? []).map((key) => ({ key, value: valueAt(layer.data, key), layer: layer.path }))),
    connectors: mergeBy(pick("connectors").map((list) => list ?? []), (entry) => entry.id),
    triggers: mergeBy(pick("triggers").map((list) => list ?? []), (entry) => entry.id),
    records: resolveRecords(mergeBy(pick("records").map((list) => list ?? []), (entry) => entry.folder)),
    name: lastDefined(pick("name")),
    cap: lastDefined(pick("cap")),
    priorities: lastDefined(pick("priorities")) ?? DEFAULT_PRIORITIES,
    owner: lastDefined(pick("owner")),
    product: lastDefined(pick("product")),
    team: lastDefined(pick("team")),
    formerly: [...new Set(pick("formerly").flatMap((names) => names ?? []))],
    copies: {
      source,
      sets: Object.assign({}, sourceSets(source, repo), ...pick("copies").map((copies) => copies?.sets)),
      use: [...new Set(pick("copies").flatMap((copies) => copies?.use ?? []))],
    },
  };
  if (config.name === undefined) delete config.name;
  if (config.cap === undefined) delete config.cap;
  if (config.owner === undefined) delete config.owner;
  if (config.product === undefined) delete config.product;
  if (config.team === undefined) delete config.team;
  if (Object.keys(config.expo ?? {}).length === 0) delete config.expo;
  return { config, sources };
}
