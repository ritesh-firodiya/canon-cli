import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../lib/files.ts";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import { REMOVED_WIKI_FOLDERS, WIKI_FOLDER_BY_TYPE } from "../config/schema.ts";
import type { Check, Finding } from "./types.ts";

const REQUIRED_FIELDS = ["last-verified"];
// Filler an agent would read as fact: a section with nothing to say is deleted, not stubbed.
const PLACEHOLDER = /\bTBD\b|\bnone yet\b|\bpopulate when\b/i;
const CODE_BLOCK = /```[\s\S]*?```/g;
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
  description: "every wiki page has last-verified and no placeholder text; a type, if set, matches its folder; ids are unique; nothing stale",
  run({ repo, config, today }) {
    const folderByType = { ...WIKI_FOLDER_BY_TYPE, ...Object.fromEntries(config.wiki.types.map((entry) => [entry.type, entry.folder])) };
    // Built-in types' sections are linted by the wiki-lint skill; added types carry theirs in config.
    const sectionsByType = new Map(config.wiki.types.map((entry) => [entry.type, entry.sections]));
    const findings: Finding[] = [];
    const add = (level: Finding["level"], file: string, message: string) =>
      findings.push({ check: "wiki-frontmatter", level, file, message });
    const filesById = new Map<string, string[]>();
    const stale: Array<{ file: string; age: number }> = [];

    for (const file of wikiPages(repo)) {
      const folder = file.split("/")[2];
      if (folder in REMOVED_WIKI_FOLDERS) continue; // context-size reports the folder once
      const { data, body } = parseFrontmatter(readFileSync(join(repo, file), "utf8"));
      if (!data) {
        add("error", file, "no frontmatter");
        continue;
      }
      const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined || data[field] === null);
      if (missing.length > 0) add("error", file, `missing ${missing.join(", ")}`);

      const expected = folderByType[String(data.type)];
      if (data.type && expected !== folder) add("error", file, `type ${data.type} does not belong in ${folder}/`);
      if (!data.type && !Object.values(folderByType).includes(folder)) add("error", file, `${folder}/ is not a wiki folder`);

      const sections = sectionsByType.get(String(data.type));
      if (sections) {
        const headings = new Set(body.split("\n").flatMap((line) => (line.startsWith("## ") ? [line.slice(3).trim()] : [])));
        const absent = sections.filter((section) => !headings.has(section));
        if (absent.length > 0) add("error", file, `missing sections: ${absent.join(", ")}`);
      }

      const placeholder = body.replace(CODE_BLOCK, "").match(PLACEHOLDER);
      if (placeholder) add("warn", file, `placeholder "${placeholder[0]}" — write the fact or delete the section`);

      const verified = asDate(data["last-verified"]);
      const age = verified ? Math.floor((today.getTime() - verified.getTime()) / DAY_MS) : 0;
      if (verified && age > STALE_AFTER_DAYS) stale.push({ file, age });
      if (verified && age < 0) add("error", file, `last-verified ${data["last-verified"]} is in the future`);

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
