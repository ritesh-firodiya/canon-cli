export type Family = "haiku" | "sonnet" | "opus";

const MODELS_URL = "https://api.anthropic.com/v1/models?limit=1000";
const LOOKUP_TIMEOUT_MS = 1500;
const API_VERSION = "2023-06-01";

interface ModelRow {
  id: string;
  created_at: string;
}

const found = new Map<Family, string>();

/** The newest model id in a family, from the live models list. Without an API key or a reply, the family alias, which Claude Code resolves to the newest itself. */
export async function latestModel(family: Family, key: string | undefined, fetcher?: typeof fetch): Promise<string> {
  if (!key) return family;
  const known = found.get(family);
  if (known) return known;
  try {
    const response = await (fetcher ?? fetch)(MODELS_URL, { headers: { "x-api-key": key, "anthropic-version": API_VERSION }, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!response.ok) return family;
    const rows = ((await response.json()) as { data?: ModelRow[] }).data ?? [];
    const newest = rows.filter((row) => row.id.startsWith(`claude-${family}-`)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!newest) return family;
    found.set(family, newest.id);
    return newest.id;
  } catch {
    return family;
  }
}
