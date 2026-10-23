import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../lib/files.ts";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import type { Check, Finding } from "./types.ts";

const REQUIRED_FIELDS = ["id", "type", "status", "last-verified"];
const FOLDER_BY_TYPE: Record<string, string> = {
  concept: "concepts",
  entity: "entities",
  surface: "surfaces",
  flow: "flows",
  decision: "decisions",
  synthesis: "synthesis",
};
const STALE_AFTER_DAYS = 90;
const DAY_MS = 86_400_000;
const NOT_PAGES = ["index.md", "CLAUDE.md"];
const OLDEST_SHOWN = 3;

export function wikiPages(repo: string): string[] {
  return listFiles(repo, ".context/wiki", (name) => name.endsWith(".md") && !NOT_PAGES.includes(name));
}

function asDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export const wikiFrontmatter: Check = {
  id: "wiki-frontmatter",
  module: "docs",
  description: "every wiki page has id, type, status and last-verified; type matches folder; ids are unique; nothing stale",
  run({ repo, today }) {
    const findings: Finding[] = [];
    const add = (level: Finding["level"], file: string, message: string) =>
      findings.push({ check: "wiki-frontmatter", level, file, message });
    const filesById = new Map<string, string[]>();
    const stale: Array<{ file: string; age: number }> = [];

    for (const file of wikiPages(repo)) {
      const { data } = parseFrontmatter(readFileSync(join(repo, file), "utf8"));
      if (!data) {
        add("error", file, "no frontmatter");
        continue;
      }
      const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined || data[field] === null);
      if (missing.length > 0) add("error", file, `missing ${missing.join(", ")}`);

      const folder = file.split("/")[2];
      const expected = FOLDER_BY_TYPE[String(data.type)];
      if (data.type && expected !== folder) add("error", file, `type ${data.type} does not belong in ${folder}/`);

      if (data.status === "superseded" && !data["superseded-by"]) add("error", file, "superseded without superseded-by");

      const verified = asDate(data["last-verified"]);
      const age = verified ? Math.floor((today.getTime() - verified.getTime()) / DAY_MS) : 0;
      if (verified && age > STALE_AFTER_DAYS) stale.push({ file, age });

      if (data.id) filesById.set(String(data.id), [...(filesById.get(String(data.id)) ?? []), file]);
    }
    // One line per product: hundreds of "page X is stale" lines bury every other finding.
    if (stale.length > 0) {
      const oldest = stale
        .sort((a, b) => b.age - a.age)
        .slice(0, OLDEST_SHOWN)
        .map(({ file, age }) => `${file.replace(".context/wiki/", "")} (${age}d)`);
      const pages = stale.length === 1 ? "1 page" : `${stale.length} pages`;
      add("warn", ".context/wiki", `${pages} last verified over ${STALE_AFTER_DAYS} days ago — oldest: ${oldest.join(", ")}`);
    }
    for (const [id, files] of filesById) {
      if (files.length > 1) add("error", files[1], `duplicate id ${id} (also ${files[0]})`);
    }
    return findings;
  },
};
