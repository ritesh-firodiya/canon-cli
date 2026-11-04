import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseDocument } from "yaml";
import { FEATURES, type Feature } from "../../config/schema.ts";

const FIELD = "features";

function assertFeature(name: string): void {
  if (!(FEATURES as readonly string[]).includes(name)) throw new Error(`unknown feature "${name}" — choose from: ${FEATURES.join(", ")}`);
}

const userFile = (): string => join(process.env.CANON_HOME ?? join(homedir(), ".canon"), "features.json");

/** What this machine turns on everywhere: a person's own default, outside any repo, so it is never committed. */
export function readUserFeatures(): Feature[] {
  try {
    const list: unknown = JSON.parse(readFileSync(userFile(), "utf8"));
    return Array.isArray(list) ? list.filter((name): name is Feature => (FEATURES as readonly unknown[]).includes(name)) : [];
  } catch {
    return [];
  }
}

export function setUserFeature(name: string, isOn: boolean): string[] {
  assertFeature(name);
  const current = readUserFeatures() as string[];
  const next = isOn ? [...new Set([...current, name])] : current.filter((feature) => feature !== name);
  mkdirSync(dirname(userFile()), { recursive: true });
  writeFileSync(userFile(), `${JSON.stringify(next)}\n`);
  return next;
}

/** Turns one feature on or off in the repo's context.yaml, keeping the rest as written. Returns what is on now. */
export function setFeature(repo: string, name: string, isOn: boolean): string[] {
  assertFeature(name);
  const file = join(repo, ".context", "context.yaml");
  const exists = existsSync(file);
  if (!exists && !isOn) return [];
  const text = exists ? readFileSync(file, "utf8") : "";
  const doc = parseDocument(text);
  if (doc.errors.length > 0) throw new Error(`${file} does not parse: ${doc.errors[0].message}`);
  const current = (doc.toJS()?.[FIELD] ?? []) as string[];
  const next = isOn ? [...new Set([...current, name])] : current.filter((feature) => feature !== name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, withField(text, next));
  return next;
}

/** Replaces only the field's own lines: a person's formatting elsewhere in the file is theirs. */
function withField(text: string, features: string[]): string {
  const block = features.length > 0 ? [`${FIELD}:`, ...features.map((feature) => `  - ${feature}`)] : [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const start = lines.findIndex((line) => line.startsWith(`${FIELD}:`));
  if (start === -1) return [...lines, ...block, ""].join("\n");
  const after = lines.findIndex((line, index) => index > start && !/^(\s|$)/.test(line));
  const end = after === -1 ? lines.length : after;
  return [...lines.slice(0, start), ...block, ...lines.slice(end), ""].join("\n");
}

const PLUGINS: Record<string, string> = { process: "canon-process", knowledge: "canon-knowledge" };

/** The Claude Code command that adds or removes a feature's plugin for one repo. Null when it has none: routing lives in the band. */
export function pluginCommand(name: string, isOn: boolean, scope: "project" | "user" = "project"): string[] | null {
  const plugin = PLUGINS[name];
  return plugin ? ["plugin", isOn ? "install" : "uninstall", `${plugin}@canon`, "--scope", scope] : null;
}
