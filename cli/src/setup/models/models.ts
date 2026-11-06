import { closeSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { transcriptFiles } from "../../lib/transcripts.ts";
import { listId, priceOf, type Price } from "./prices.ts";

export type Size = "small" | "medium" | "large";
const SIZES: readonly Size[] = ["small", "medium", "large"];
const PRICE_FIELDS: readonly (keyof Price)[] = ["input", "output", "write5m", "write1h", "cacheRead"];

export interface ModelEntry {
  id: string;
  /** Null: listed, but never routed to, since nobody said how big it is. */
  size: Size | null;
  /** USD per million tokens; null when neither config nor the shipped list prices know it. */
  price: Price | null;
  source: string;
  /** The Claude model it was sized and priced as, when that is not the id itself: public list price, not an org's rate. */
  runs?: string;
}

/** What a company or a person sets in `~/.canon/models.config.json`. It wins over everything found. */
export interface ModelsConfig {
  models?: Record<string, unknown>;
  prices?: Record<string, unknown>;
}

export interface ModelsInput {
  /** Claude Code settings objects, lowest precedence first. */
  settings: Record<string, unknown>[];
  env: Record<string, string | undefined>;
  /** Ids `/v1/models` returned, when there is an API key. */
  apiIds: string[];
  /** Ids recent sessions ran on, newest first: what the family names resolve to on this machine. */
  usedIds: string[];
  config: ModelsConfig;
}

// The env names Claude Code reads for its model slots; a slot says the size.
const ENV_SLOTS: [string, Size | null][] = [
  ["ANTHROPIC_MODEL", null],
  ["ANTHROPIC_DEFAULT_HAIKU_MODEL", "small"],
  ["ANTHROPIC_DEFAULT_SONNET_MODEL", "medium"],
  ["ANTHROPIC_DEFAULT_OPUS_MODEL", "large"],
  ["ANTHROPIC_SMALL_FAST_MODEL", "small"],
];
// What Claude Code resolves with no model set; also a size hint when an id carries one of these names.
const FAMILIES: [string, Size][] = [["haiku", "small"], ["sonnet", "medium"], ["opus", "large"]];

function checkSize(id: string, value: unknown): Size {
  if (SIZES.includes(value as Size)) return value as Size;
  throw new Error(`models.config.json: the size of ${id} must be one of ${SIZES.join(", ")}, not ${JSON.stringify(value)}`);
}

function checkPrice(id: string, value: unknown): Price {
  const row = value as Record<string, unknown> | null;
  if (row && PRICE_FIELDS.every((field) => typeof row[field] === "number" && Number.isFinite(row[field]))) return row as unknown as Price;
  throw new Error(`models.config.json: the price of ${id} needs ${PRICE_FIELDS.join(", ")} as numbers (USD per million tokens)`);
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item !== "") : typeof value === "string" && value ? [value] : []);

const mainIds = (input: ModelsInput): string[] => [...input.settings.flatMap((settings) => strings(settings.model)), ...strings(input.env.ANTHROPIC_MODEL)];

/**
 * The model an id runs, as far as this machine shows. A bare family name (`opus[1m]`) runs what recent sessions
 * ran in that family. An org's own name for its main model (`acme.standard`) runs the newest Claude model the
 * sessions name, since nothing else says. No table says either.
 */
function resolved(id: string, input: ModelsInput): string {
  const family = FAMILIES.find(([name]) => listId(id) === name)?.[0];
  if (family) return input.usedIds.find((used) => used.includes(`-${family}-`)) ?? id;
  if (priceOf(id, 0) || !mainIds(input).includes(id)) return id;
  return input.usedIds.find((used) => priceOf(used, 0)) ?? id;
}

const configPrices = (config: ModelsConfig): Record<string, Price> => Object.fromEntries(Object.entries(config.prices ?? {}).map(([id, price]) => [id, checkPrice(id, price)]));

/** A model's price: the config's, else the public list price of what it runs, else null. */
export const priceIn = (input: ModelsInput, id: string, prompt: number): Price | null => configPrices(input.config)[id] ?? priceOf(resolved(id, input), prompt);

/** Every model this machine can run, sized and priced. Pure, so the tests hand it what a machine would hold. */
export function gatherModels(input: ModelsInput): ModelEntry[] {
  const configSizes = Object.fromEntries(Object.entries(input.config.models ?? {}).map(([id, size]) => [id, checkSize(id, size)]));
  configPrices(input.config); // a bad price fails here, even for a model nobody lists
  const found: { id: string; slot: Size | null; source: string }[] = [];
  const add = (id: string, slot: Size | null, source: string) => {
    const known = found.find((entry) => entry.id === id);
    if (!known) found.push({ id, slot, source });
    else if (!known.slot) known.slot = slot;
  };
  for (const settings of input.settings) {
    for (const id of strings(settings.availableModels)) add(id, null, "settings availableModels");
    for (const id of strings(settings.model)) add(id, null, "settings model");
  }
  for (const [name, slot] of ENV_SLOTS) for (const id of strings(input.env[name])) add(id, slot, `env ${name}`);
  for (const id of input.apiIds) add(id, null, "api");
  for (const id of input.usedIds) add(id, null, "used");
  for (const id of Object.keys(configSizes)) add(id, null, "config");
  // A Claude Code login can always run the families, unless `availableModels` limits the list.
  const isLimited = input.settings.some((settings) => strings(settings.availableModels).length > 0);
  if (!isLimited) for (const [family] of FAMILIES) add(family, null, "claude code default");

  return found.map(({ id, slot, source }) => ({
    id,
    ...(resolved(id, input) === id ? {} : { runs: resolved(id, input) }),
    size: configSizes[id] ?? slot ?? FAMILIES.find(([family]) => resolved(id, input).toLowerCase().includes(family))?.[1] ?? null,
    price: priceIn(input, id, 0),
    source,
  }));
}

const canonHome = (): string => process.env.CANON_HOME ?? join(homedir(), ".canon");
export const modelsFile = (): string => join(canonHome(), "models.json");
const configFile = (): string => join(canonHome(), "models.config.json");

// Claude Code's settings files, lowest precedence first; a project's own settings are left out, since models.json is the machine's.
const SETTINGS_FILES = (): string[] => [
  join(homedir(), ".claude", "settings.json"),
  "/Library/Application Support/ClaudeCode/managed-settings.json",
  "/etc/claude-code/managed-settings.json",
];

function readJson(file: string): Record<string, unknown> | null {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${(error as Error).message}`);
  }
}

const RECENT_SESSIONS = 20;
// The band asks on every refresh and a long chat is many MB; its last replies name the model it runs.
const TAIL_BYTES = 256 * 1024;
// A reply names its model; Claude Code's identity note names the real one behind an org's own name.
const MODEL_FIELD = /"model(?:Id)?":"([^"<][^"]*)"/g;

function tail(file: string, size: number): string {
  const length = Math.min(size, TAIL_BYTES);
  const buffer = Buffer.alloc(length);
  const fd = openSync(file, "r");
  try {
    readSync(fd, buffer, 0, length, size - length);
  } finally {
    closeSync(fd);
  }
  return buffer.toString("utf8");
}

/** The model ids the newest sessions ran on, newest first. */
export function usedModelIds(files: string[] = transcriptFiles()): string[] {
  const newest = files
    .map((file) => ({ file, stat: statSync(file) }))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    .slice(0, RECENT_SESSIONS);
  const ids = newest.flatMap(({ file, stat }) => [...tail(file, stat.size).matchAll(MODEL_FIELD)].map((match) => match[1] as string));
  return [...new Set(ids)];
}

let scanned: ModelsInput | null = null;

/** What this machine runs now: settings, environment, config and recent sessions. Scanned once per process; no list in the code. */
export function machineModels(): ModelsInput {
  scanned ??= {
    settings: SETTINGS_FILES().map(readJson).filter((value): value is Record<string, unknown> => value !== null),
    env: process.env,
    apiIds: [],
    usedIds: usedModelIds(),
    config: (readJson(configFile()) ?? {}) as ModelsConfig,
  };
  return scanned;
}

/** Every priced model on this machine, by id, for the band. */
export const machinePrices = (): Record<string, Price> => Object.fromEntries(gatherModels(machineModels()).flatMap((m) => (m.price ? [[m.id, m.price]] : [])));

/** A model's price on this machine, for `canon learn --cost`. */
export const priceFor = (id: string, prompt: number): Price | null => priceIn(machineModels(), id, prompt);

const MODELS_URL = "https://api.anthropic.com/v1/models?limit=1000";
const API_VERSION = "2023-06-01";
const LOOKUP_TIMEOUT_MS = 5000;

/** The ids an API key can call; none without a key, or when the call fails, since the rest of the list still stands. */
export async function apiModelIds(key: string | undefined, fetcher: typeof fetch = fetch): Promise<{ ids: string[]; error: string | null }> {
  if (!key) return { ids: [], error: null };
  try {
    const response = await fetcher(MODELS_URL, { headers: { "x-api-key": key, "anthropic-version": API_VERSION }, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!response.ok) return { ids: [], error: `/v1/models answered HTTP ${response.status}` };
    const rows = ((await response.json()) as { data?: { id?: unknown }[] }).data ?? [];
    return { ids: rows.map((row) => row.id).filter((id): id is string => typeof id === "string"), error: null };
  } catch (error) {
    return { ids: [], error: `/v1/models: ${(error as Error).message}` };
  }
}

export interface ModelsFile {
  at: string;
  models: ModelEntry[];
  warnings: string[];
}

/** Finds the machine's models and writes `~/.canon/models.json`. */
export async function writeModels(fetcher?: typeof fetch): Promise<ModelsFile> {
  const api = await apiModelIds(process.env.ANTHROPIC_API_KEY, fetcher);
  const models = gatherModels({ ...machineModels(), apiIds: api.ids });
  const result: ModelsFile = { at: new Date().toISOString(), models, warnings: api.error ? [api.error] : [] };
  mkdirSync(dirname(modelsFile()), { recursive: true });
  writeFileSync(modelsFile(), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const usd = (value: number): string => `$${value}`;

export function formatModels(file: ModelsFile): string {
  const lines = file.models.map((m) => `${m.id.padEnd(32)} ${(m.size ?? "no size").padEnd(8)} ${m.price ? `${usd(m.price.input)} in, ${usd(m.price.output)} out per M` : "price ?"}   ${m.source}${m.runs ? `, list price of ${m.runs}` : ""}`);
  const unsized = file.models.filter((m) => !m.size).length;
  return [
    ...lines,
    ...file.warnings.map((warning) => `warning: ${warning}`),
    ...(unsized ? [`${unsized} model(s) have no size and are never routed to: set one in ${configFile()}`] : []),
    `wrote ${modelsFile()}`,
  ].join("\n");
}
