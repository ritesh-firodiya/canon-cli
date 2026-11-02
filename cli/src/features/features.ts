import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseDocument } from "yaml";
import { FEATURES } from "../config/schema.ts";

const FIELD = "features";

/** Turns one feature on or off in the repo's context.yaml, keeping the rest as written. Returns what is on now. */
export function setFeature(repo: string, name: string, isOn: boolean): string[] {
  if (!(FEATURES as readonly string[]).includes(name)) throw new Error(`unknown feature "${name}" — choose from: ${FEATURES.join(", ")}`);
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

const PLUGINS: Record<string, string> = { process: "canon-process", knowledge: "canon-knowledge", styles: "canon-styles" };

/** The Claude Code command that adds or removes a feature's plugin for one repo. Null when it has none: routing lives in the band. */
export function pluginCommand(name: string, isOn: boolean): string[] | null {
  const plugin = PLUGINS[name];
  return plugin ? ["plugin", isOn ? "install" : "uninstall", `${plugin}@canon`, "--scope", "project"] : null;
}
