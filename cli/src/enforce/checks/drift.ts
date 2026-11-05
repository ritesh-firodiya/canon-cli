import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parseFrontmatter } from "../../lib/frontmatter.ts";
import { asDate, wikiPages } from "./wiki-frontmatter.ts";
import type { Check, Finding } from "./types.ts";

const CODE_BLOCK = /```[\s\S]*?```/g;
const BACKTICKED = /`([^`\n]+)`/g;
const EXTENSION = /\.[A-Za-z][A-Za-z0-9]*$/;
const NOT_A_PATH = /\s|:\/\/|[*?{]|^(~\/|\/|\.\.?\/|\.context\/)/;
const DAY_MS = 86_400_000;

/** The repo paths a page names in backticks: a folder and a file with an extension, not a URL, glob, command or `.md` page. */
export function namedPaths(body: string): string[] {
  const tokens = [...body.replace(CODE_BLOCK, "").matchAll(BACKTICKED)].map((match) => match[1]);
  const paths = tokens.filter((token) => token.includes("/") && !NOT_A_PATH.test(token) && EXTENSION.test(token) && !token.endsWith(".md"));
  return [...new Set(paths)];
}

/** When git last changed `path`; null when the repo has no git or no history for it. */
function lastChanged(repo: string, path: string): Date | null {
  const out = spawnSync("git", ["-C", repo, "log", "-1", "--format=%cI", "--", path], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).stdout?.trim();
  return out ? asDate(out) : null;
}

export function runDrift(repo: string): Finding[] {
  const findings: Finding[] = [];
  for (const file of wikiPages(repo)) {
    const { data, body } = parseFrontmatter(readFileSync(join(repo, file), "utf8"));
    const verified = data ? asDate(data["last-verified"]) : null;
    if (!verified) continue; // wiki-frontmatter reports a missing or broken date
    const named = namedPaths(body);
    const gone = named.filter((path) => !existsSync(join(repo, path)));
    const changed = named.filter((path) => !gone.includes(path) && (lastChanged(repo, path)?.getTime() ?? 0) > verified.getTime() + DAY_MS);
    if (gone.length > 0) findings.push({ check: "drift", level: "error", file, message: `a file no longer in the tree: ${gone.join(", ")}` });
    if (changed.length > 0) {
      findings.push({ check: "drift", level: "warn", file, message: `the code changed after ${verified.toISOString().slice(0, 10)}: ${changed.join(", ")}` });
    }
  }
  return findings;
}

export const drift: Check = {
  id: "drift",
  module: "docs",
  description: "each wiki page matches the code it names: a named file exists, and none changed after the page's last-verified date",
  run: ({ repo }) => runDrift(repo),
};
