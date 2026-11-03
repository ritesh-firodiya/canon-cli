export interface Price {
  input: number;
  output: number;
  write5m: number;
  write1h: number;
  cacheRead: number;
}

export interface KindCost {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number };
}

const price = (input: number, write5m: number, write1h: number, cacheRead: number, output: number): Price => ({ input, write5m, write1h, cacheRead, output });

const HAIKU_LARGE_PROMPT = 100_000;
const HAIKU_LARGE = price(0.5, 0.625, 1, 0.05, 2.5);
const PER_MILLION = 1_000_000;

// USD per million tokens, from platform.claude.com/docs/en/about-claude/pricing on 2026-11-02.
// shortcut: fast mode and US-only inference are priced as standard, add them when a report needs them.
const PRICES: [string, Price][] = (
  [
    ["claude-fable-5-1", price(10, 12.5, 20, 0.25, 50)],
    ["claude-mythos-5-1", price(10, 12.5, 20, 0.25, 50)],
    ["claude-fable-5", price(10, 12.5, 20, 1, 50)],
    ["claude-mythos-5", price(10, 12.5, 20, 1, 50)],
    ["claude-opus-5-5", price(4, 5, 8, 0.2, 20)],
    ["claude-opus-5", price(5, 6.25, 10, 0.5, 25)],
    ["claude-opus-4-8", price(5, 6.25, 10, 0.5, 25)],
    ["claude-opus-4-7", price(5, 6.25, 10, 0.5, 25)],
    ["claude-opus-4-6", price(5, 6.25, 10, 0.5, 25)],
    ["claude-opus-4-5", price(5, 6.25, 10, 0.5, 25)],
    ["claude-sonnet-5-5", price(2, 2.5, 4, 0.1, 10)],
    ["claude-sonnet-5", price(2, 2.5, 4, 0.2, 10)],
    ["claude-sonnet-4-6", price(3, 3.75, 6, 0.3, 15)],
    ["claude-sonnet-4-5", price(3, 3.75, 6, 0.3, 15)],
    ["claude-haiku-5-5", price(0.1, 0.125, 0.2, 0.01, 0.5)],
    ["claude-haiku-4-5", price(1, 1.25, 2, 0.1, 5)],
  ] as [string, Price][]
).sort((a, b) => b[0].length - a[0].length);

export const tokens = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export const promptTokens = (usage: Usage): number => tokens(usage.input_tokens) + tokens(usage.cache_creation_input_tokens) + tokens(usage.cache_read_input_tokens);

/** A model's list price, or null when this table does not know it. A dated id finds its model. */
// What a bare family name runs today, as Claude Code resolves it without an API key. Move with the newest rows above.
const ALIASES: Record<string, string> = { haiku: "claude-haiku-5-5", sonnet: "claude-sonnet-5-5", opus: "claude-opus-5-5" };

export function priceOf(alias: string, prompt: number): Price | null {
  const model = ALIASES[alias] ?? alias;
  const found = PRICES.find(([prefix]) => model.startsWith(prefix))?.[1] ?? null;
  return found && model.startsWith("claude-haiku-5-5") && prompt > HAIKU_LARGE_PROMPT ? HAIKU_LARGE : found;
}

/** What one reply costs at list price, by kind of token. */
export function costOf(usage: Usage, model: string): KindCost | null {
  const rate = priceOf(model, promptTokens(usage));
  if (!rate) return null;
  const written = tokens(usage.cache_creation_input_tokens);
  const short = tokens(usage.cache_creation?.ephemeral_5m_input_tokens);
  // With no split, assume the hour: it is what a plan's main session writes.
  const long = usage.cache_creation ? tokens(usage.cache_creation.ephemeral_1h_input_tokens) : written;
  return {
    input: (tokens(usage.input_tokens) * rate.input) / PER_MILLION,
    output: (tokens(usage.output_tokens) * rate.output) / PER_MILLION,
    cacheWrite: (short * rate.write5m + long * rate.write1h) / PER_MILLION,
    cacheRead: (tokens(usage.cache_read_input_tokens) * rate.cacheRead) / PER_MILLION,
  };
}
