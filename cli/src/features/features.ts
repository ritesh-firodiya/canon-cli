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
  const doc = parseDocument(exists ? readFileSync(file, "utf8") : "");
  if (doc.errors.length > 0) throw new Error(`${file} does not parse: ${doc.errors[0].message}`);
  const current = (doc.toJS()?.[FIELD] ?? []) as string[];
  const next = isOn ? [...new Set([...current, name])] : current.filter((feature) => feature !== name);
  if (next.length > 0) doc.set(FIELD, next);
  else doc.delete(FIELD);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, doc.toString());
  return next;
}
