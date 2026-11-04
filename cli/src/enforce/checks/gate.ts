import { lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { runChecks } from "./check.ts";
import { ALL_CHECKS } from "./index.ts";
import type { Finding } from "./types.ts";

// Too large to copy per write, and no page rule reads inside them: linked whole.
const LINKED_WHOLE = new Set(["designs", "packs", "node_modules"]);

/** The repo as it would be with `file` holding `content`: every other path a link back, so nothing is copied. */
function overlay(repo: string, file: string, content: string | null): string {
  const root = mkdtempSync(join(tmpdir(), "canon-gate-"));
  const target = relative(repo, file).split(sep);
  const mirror = (from: string, to: string, path: string[]) => {
    mkdirSync(to, { recursive: true });
    for (const name of readdirSync(from)) {
      const onPath = path[0] === name;
      const source = join(from, name);
      // Mirror only the folders on the way to the page, so the page can be written without touching the repo.
      if (onPath && path.length > 1 && lstatSync(source).isDirectory() && !LINKED_WHOLE.has(name)) mirror(source, join(to, name), path.slice(1));
      else if (!(onPath && path.length === 1 && content !== null)) symlinkSync(source, join(to, name));
    }
  };
  mirror(repo, root, target);
  if (content !== null) {
    const at = join(root, ...target);
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, content);
  }
  return root;
}

// The rules about code and designs run in `canon check`: a page cannot break them, and they cost seconds a write should not wait.
const NOT_PAGE_RULES = new Set(["architecture", "commands", "designs", "designs-first"]);
const PAGE_RULES = ALL_CHECKS.filter((check) => !NOT_PAGE_RULES.has(check.id));

const key = (finding: Finding) => `${finding.check}|${finding.file ?? ""}|${finding.message}`;

/**
 * What writing `content` to `file` would newly break: the full check on the repo as it is, and as it would be,
 * so a page is judged by every rule the repo has, and only for what it adds.
 */
export function gate(repo: string, file: string, content: string, canonRoot: string): Finding[] {
  // A page under a linked folder cannot be written apart from the repo, and no page rule reads there.
  if (relative(repo, file).split(sep).slice(0, -1).some((name) => LINKED_WHOLE.has(name))) return [];
  const before = overlay(repo, file, null);
  const after = overlay(repo, file, content);
  try {
    // Both runs see the same links, so a rule that cannot follow one reports it in both and cancels out.
    const known = new Set(runChecks(before, { canonRoot, checks: PAGE_RULES }).findings.map(key));
    return runChecks(after, { canonRoot, checks: PAGE_RULES }).findings.filter((finding) => !known.has(key(finding)));
  } finally {
    rmSync(before, { recursive: true, force: true });
    rmSync(after, { recursive: true, force: true });
  }
}
