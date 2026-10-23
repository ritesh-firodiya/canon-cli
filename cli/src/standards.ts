import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Standard {
  name: string;
  path: string;
  /** "zeno" for a built-in default, else the configured folder it came from. */
  from: string;
}

const NOT_STANDARDS = new Set(["README.md"]);
const PRINCIPLE = /^### (C-\d{2}) (.+)$/;

function markdownIn(dir: string): string[] {
  return readdirSync(dir).filter((file) => file.endsWith(".md") && !NOT_STANDARDS.has(file));
}

/** zeno's default standards, then each configured folder in order; a later file of the same name replaces an earlier one. */
export function resolveStandards(zenoRoot: string, folders: string[]): Standard[] {
  const byName = new Map<string, Standard>();
  const sources = [{ dir: join(zenoRoot, "standards"), from: "zeno" }, ...folders.map((dir) => ({ dir, from: dir }))];
  for (const { dir, from } of sources) {
    if (!existsSync(dir)) throw new Error(`standards folder not found: ${dir}`);
    for (const file of markdownIn(dir)) {
      const name = file.replace(/\.md$/, "");
      // Constitutions add up (see constitutionTitles), so each one keeps its own entry.
      const key = name === "constitution" ? `${name}:${from}` : name;
      byName.set(key, { name, path: join(dir, file), from });
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name) || Number(a.from !== "zeno") - Number(b.from !== "zeno"));
}

/**
 * Principle headings from zeno's constitution and every configured one. A
 * constitution in a folder extends rather than replaces: it adds principles,
 * and restating an ID rewords it.
 */
export function constitutionTitles(zenoRoot: string, folders: string[]): string[] {
  const titles = new Map<string, string>();
  for (const dir of [join(zenoRoot, "standards"), ...folders]) {
    const file = join(dir, "constitution.md");
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = PRINCIPLE.exec(line);
      if (match) titles.set(match[1], `${match[1]} ${match[2]}`);
    }
  }
  return [...titles.values()];
}
