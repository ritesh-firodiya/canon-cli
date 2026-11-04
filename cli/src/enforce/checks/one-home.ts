import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../../lib/files.ts";
import { parseFrontmatter } from "../../lib/frontmatter.ts";
import type { Check, Finding } from "./types.ts";

// A sentence this long is a fact, not a phrase like "See the plan."; shorter ones repeat by chance.
const MIN_CHARS = 60;
const SENTENCE = /[^.!?\n]+[.!?]/g;
const CODE_BLOCK = /```[\s\S]*?```/g;
// Records repeat their template's wording; designs and copies have their own checks.
const SKIPPED = /^\.context\/(designs|packs)\//;

const normal = (text: string) => text.toLowerCase().replace(/[`*_[\]()]/g, "").replace(/\s+/g, " ").trim();

function sentences(text: string): string[] {
  const body = parseFrontmatter(text).body.replace(CODE_BLOCK, "");
  return (body.match(SENTENCE) ?? []).map(normal).filter((sentence) => sentence.length >= MIN_CHARS && !sentence.startsWith("<!--"));
}

export const oneHome: Check = {
  id: "one-home",
  module: "docs",
  description: "each fact has one home: no sentence of 60 or more characters appears in two .context pages (C-02)",
  run({ repo }) {
    const findings: Finding[] = [];
    const seen = new Map<string, string>();
    const pages = listFiles(repo, ".context", (name) => name.endsWith(".md")).filter((file) => !SKIPPED.test(file));
    for (const file of pages) {
      for (const sentence of new Set(sentences(readFileSync(join(repo, file), "utf8")))) {
        const home = seen.get(sentence);
        if (!home) seen.set(sentence, file);
        else if (home !== file) findings.push({ check: "one-home", level: "warn", file, message: `repeats ${home}: "${sentence.slice(0, 70)}…" — keep it in one page and link to it` });
      }
    }
    return findings;
  },
};
