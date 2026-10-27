import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isStandardName } from "./config/schema.ts";

export interface Standard {
  name: string;
  path: string;
  /** "canon" for a built-in default, else the configured folder it came from. */
  from: string;
}

const NOT_STANDARDS = new Set(["README.md"]);
const PRINCIPLE = /^### (C-\d{2}) (.+)$/;

function markdownIn(dir: string): string[] {
  return readdirSync(dir).filter((file) => file.endsWith(".md") && !NOT_STANDARDS.has(file));
}

/** The opt-in standards canon ships; a repo imports one by name under `standards:`. */
export function libraryStandards(canonRoot: string): string[] {
  const dir = join(canonRoot, "standards", "library");
  return existsSync(dir) ? markdownIn(dir).map((file) => file.replace(/\.md$/, "")).sort() : [];
}

function libraryFile(canonRoot: string, name: string): string {
  const path = join(canonRoot, "standards", "library", `${name}.md`);
  if (!existsSync(path)) throw new Error(`no canon standard named ${name} — canon has: ${libraryStandards(canonRoot).join(", ")}`);
  return path;
}

/**
 * canon's defaults, then each `standards:` entry in order: a name imports canon's library
 * standard, a folder adds its files. A later file of the same name replaces an earlier one.
 */
export function resolveStandards(canonRoot: string, entries: string[]): Standard[] {
  const byName = new Map<string, Standard>();
  const add = (name: string, path: string, from: string) => {
    // Constitutions add up (see constitutionTitles), so each one keeps its own entry.
    byName.set(name === "constitution" ? `${name}:${from}` : name, { name, path, from });
  };
  const defaults = join(canonRoot, "standards");
  for (const entry of [defaults, ...entries]) {
    if (isStandardName(entry)) {
      add(entry, libraryFile(canonRoot, entry), "canon library");
      continue;
    }
    if (!existsSync(entry)) throw new Error(`standards folder not found: ${entry}`);
    const from = entry === defaults ? "canon" : entry;
    for (const file of markdownIn(entry)) add(file.replace(/\.md$/, ""), join(entry, file), from);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name) || Number(a.from !== "canon") - Number(b.from !== "canon"));
}

/**
 * Principle headings from canon's constitution, every imported library standard
 * and every configured folder's constitution. They extend rather than replace:
 * each adds principles, and restating an ID rewords it.
 */
export function constitutionTitles(canonRoot: string, entries: string[]): string[] {
  const titles = new Map<string, string>();
  const files = [join(canonRoot, "standards"), ...entries].map((entry) =>
    isStandardName(entry) ? libraryFile(canonRoot, entry) : join(entry, "constitution.md"),
  );
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = PRINCIPLE.exec(line);
      if (match) titles.set(match[1], `${match[1]} ${match[2]}`);
    }
  }
  return [...titles.values()];
}
