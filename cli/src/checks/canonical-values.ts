import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import type { Check, Finding } from "./types.ts";
import { wikiPages } from "./wiki-frontmatter.ts";

const PRICE = /(?:[$₹€£]\s?\d[\d,]*(?:\.\d+)?)/g;
const CODE_BLOCK = /```[\s\S]*?```/g;

// An amount counts as a price only in a paragraph that talks about selling something;
// "Ravi paid ₹6,200" in a bill-splitting app is an example, not a price.
const PRICE_WORDS = /pric|cost|paywall|plan|tier|subscri|bundle|pack|purchase|buy|unlock|\/mo|per month|per year|annual|yearly|monthly/i;

function amounts(text: string): string[] {
  return (text.match(PRICE) ?? []).map((price) => price.replace(/\s/g, ""));
}

function pricesIn(text: string): string[] {
  const paragraphs = text.replace(CODE_BLOCK, "").split(/\n\s*\n/);
  return [...new Set(paragraphs.filter((paragraph) => PRICE_WORDS.test(paragraph)).flatMap(amounts))];
}

function heldAmounts(text: string): string[] {
  return amounts(text.replace(CODE_BLOCK, ""));
}

const folderOf = (file: string) => file.split("/")[2];

export const canonicalValues: Check = {
  id: "canonical-values",
  module: "docs",
  description: "a price stated in a decision or screen note is held by an entity page — one home per fact (C-02)",
  run({ repo }) {
    const pages = wikiPages(repo).map((file) => ({ file, ...parseFrontmatter(readFileSync(join(repo, file), "utf8")) }));
    const held = new Set(pages.filter((page) => folderOf(page.file) === "entities").flatMap((page) => heldAmounts(page.body)));

    // Decisions and screen notes are where prices get restated. Concepts legitimately carry
    // example amounts (a tax product explains slabs with them).
    return pages
      .filter((page) => ["decisions", "surfaces"].includes(folderOf(page.file)))
      .flatMap((page): Finding[] => {
        const orphans = pricesIn(page.body).filter((price) => !held.has(price));
        if (orphans.length === 0) return [];
        return [
          {
            check: "canonical-values",
            level: "warn",
            file: page.file,
            message: `${orphans.join(", ")} stated here but held by no entity page`,
          },
        ];
      });
  },
};
