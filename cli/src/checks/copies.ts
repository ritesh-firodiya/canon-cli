import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check, Finding } from "./types.ts";

// Instruction files for agents other than Claude Code. They are copies of
// AGENTS.md that nobody reads, so they only drift.
const OTHER_AGENT_FILES = [".github/copilot-instructions.md", ".cursorrules", ".windsurfrules"];

// Fraction of a shared standard's lines that must appear in a product file
// before it counts as a copy rather than a reference.
const COPY_THRESHOLD = 0.6;
const STANDARD_COPIES = [{ file: ".context/wiki/CLAUDE.md", standard: "standards/wiki-schema.md" }];

export const staleCopies: Check = {
  id: "stale-copies",
  module: null,
  description: "no instruction files for agents that are not used (Copilot, Cursor, Windsurf)",
  run({ repo }) {
    return OTHER_AGENT_FILES.filter((file) => existsSync(join(repo, file))).map((file) => ({
      check: "stale-copies",
      level: "warn" as const,
      file,
      message: "instructions for an agent not in use — delete, Claude reads AGENTS.md",
    }));
  },
};

function meaningfulLines(text: string): Set<string> {
  return new Set(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("<!--")),
  );
}

function sharedFraction(standard: string, candidate: string): number {
  const wanted = meaningfulLines(standard);
  const present = meaningfulLines(candidate);
  const shared = [...wanted].filter((line) => present.has(line)).length;
  return wanted.size === 0 ? 0 : shared / wanted.size;
}

export const standardsCopies: Check = {
  id: "standards-copies",
  module: null,
  description: "shared rules and skills come from zeno, not from a copy in the product",
  run({ repo, zenoRoot }) {
    const findings: Finding[] = [];
    for (const { file, standard } of STANDARD_COPIES) {
      const productFile = join(repo, file);
      const standardFile = join(zenoRoot, standard);
      if (!existsSync(productFile) || !existsSync(standardFile)) continue;
      const fraction = sharedFraction(readFileSync(standardFile, "utf8"), readFileSync(productFile, "utf8"));
      if (fraction >= COPY_THRESHOLD) {
        findings.push({
          check: "standards-copies",
          level: "warn",
          file,
          message: `${Math.round(fraction * 100)}% copy of zeno ${standard} — replace with a pointer`,
        });
      }
    }

    const zenoSkills = join(zenoRoot, "skills");
    const productSkills = join(repo, ".claude", "skills");
    if (existsSync(zenoSkills) && existsSync(productSkills)) {
      const provided = new Set(readdirSync(zenoSkills));
      for (const skill of readdirSync(productSkills)) {
        if (!provided.has(skill)) continue;
        findings.push({
          check: "standards-copies",
          level: "warn",
          file: `.claude/skills/${skill}`,
          message: `zeno provides this as zeno:${skill} — delete the product copy`,
        });
      }
    }
    return findings;
  },
};
