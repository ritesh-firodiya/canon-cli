import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { priceOf, type Price } from "../usage/prices.ts";

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

// `opus[1m]` is opus with a larger window, and a Bedrock id wraps the model's own (`us.anthropic.claude-…`).
function listId(id: string): string {
  const bare = id.replace(/\[[^\]]*\]$/, "");
  return bare.includes("claude-") ? bare.slice(bare.indexOf("claude-")) : bare;
}

/** Every model this machine can run, sized and priced. Pure, so the tests hand it what a machine would hold. */
export function gatherModels(input: ModelsInput): ModelEntry[] {
  const configSizes = Object.fromEntries(Object.entries(input.config.models ?? {}).map(([id, size]) => [id, checkSize(id, size)]));
  const configPrices = Object.fromEntries(Object.entries(input.config.prices ?? {}).map(([id, price]) => [id, checkPrice(id, price)]));
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
  for (const id of Object.keys(configSizes)) add(id, null, "config");
  // A Claude Code login can always run the families, unless `availableModels` limits the list.
  const isLimited = input.settings.some((settings) => strings(settings.availableModels).length > 0);
  if (!isLimited) for (const [family] of FAMILIES) add(family, null, "claude code default");

  return found.map(({ id, slot, source }) => ({
    id,
    size: configSizes[id] ?? slot ?? FAMILIES.find(([family]) => id.toLowerCase().includes(family))?.[1] ?? null,
    price: configPrices[id] ?? priceOf(listId(id), 0),
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
  const settings = SETTINGS_FILES().map(readJson).filter((value): value is Record<string, unknown> => value !== null);
  const api = await apiModelIds(process.env.ANTHROPIC_API_KEY, fetcher);
  const models = gatherModels({ settings, env: process.env, apiIds: api.ids, config: (readJson(configFile()) ?? {}) as ModelsConfig });
  const result: ModelsFile = { at: new Date().toISOString(), models, warnings: api.error ? [api.error] : [] };
  mkdirSync(dirname(modelsFile()), { recursive: true });
  writeFileSync(modelsFile(), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const usd = (value: number): string => `$${value}`;

export function formatModels(file: ModelsFile): string {
  const lines = file.models.map((m) => `${m.id.padEnd(32)} ${(m.size ?? "no size").padEnd(8)} ${m.price ? `${usd(m.price.input)} in, ${usd(m.price.output)} out per M` : "price ?"}   ${m.source}`);
  const unsized = file.models.filter((m) => !m.size).length;
  return [
    ...lines,
    ...file.warnings.map((warning) => `warning: ${warning}`),
    ...(unsized ? [`${unsized} model(s) have no size and are never routed to: set one in ${configFile()}`] : []),
    `wrote ${modelsFile()}`,
  ].join("\n");
}
