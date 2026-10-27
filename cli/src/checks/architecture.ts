import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, posix } from "node:path";
import type { Check, Finding } from "./types.ts";

// The names dependency-cruiser itself looks for; `canon init` writes the first.
export const RULES_FILES = [".dependency-cruiser.cjs", ".dependency-cruiser.js", ".dependency-cruiser.mjs", ".dependency-cruiser.json"];
const DEFAULT_COLLAPSE = "^(apps|packages)/[^/]+|^[^/]+/[^/]+";
const SHOWN_PER_RULE = 3;
// Mermaid refuses diagrams over 50k characters.
const MERMAID_MAX_CHARS = 50_000;
const MAX_BUFFER = 64 * 1024 * 1024;

export interface Violation {
  rule: { name: string; severity: string };
  from: string;
  to: string;
}

// Monorepo workspaces whose apps each map `@/` to their own src need one rules file each,
// because dependency-cruiser resolves aliases from a single tsconfig per run.
const WORKSPACE_PARENTS = ["apps", "packages"];

interface Rules {
  /** Folder the rules apply to, relative to the repo ("." for the root). */
  dir: string;
  file: string;
}

function rulesFile(dir: string): string | undefined {
  return RULES_FILES.find((file) => existsSync(join(dir, file)));
}

/** Every rules file in the repo: the root's, then one per workspace under apps/ and packages/. */
export function findRules(repo: string): Rules[] {
  const workspaces = WORKSPACE_PARENTS.flatMap((parent) =>
    existsSync(join(repo, parent))
      ? readdirSync(join(repo, parent), { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => `${parent}/${entry.name}`)
          .sort()
      : [],
  );
  return [".", ...workspaces].flatMap((dir) => {
    const file = rulesFile(join(repo, dir));
    return file ? [{ dir, file }] : [];
  });
}

const fromRoot = (dir: string, path: string) => posix.normalize(posix.join(dir, path));

// The rules are about committed code; a gitignored file (a stale dist/ build) is never shipped.
function ignoredBy(repo: string, paths: string[]): Set<string> {
  if (paths.length === 0) return new Set();
  const result = spawnSync("git", ["-C", repo, "check-ignore", "--stdin"], { input: paths.join("\n"), encoding: "utf8" });
  return new Set(result.stdout.split("\n").filter(Boolean));
}

// The repo's own pinned copy, never a global one, so every machine runs the same version.
function depcruiseBin(repo: string): string | undefined {
  const bin = join(repo, "node_modules", ".bin", "depcruise");
  return existsSync(bin) ? bin : undefined;
}

function depcruise(repo: string, bin: string, rules: Rules, args: string[]) {
  return spawnSync(bin, [".", "--config", rules.file, ...args], { cwd: join(repo, rules.dir), encoding: "utf8", maxBuffer: MAX_BUFFER });
}

// dependency-cruiser needs a TypeScript it supports (below 7) to read .ts files; without one it
// skips them and still reports success, so a TypeScript workspace with none read is not a pass.
function unreadTypeScript(repo: string, rules: Rules, modules: Array<{ source: string }>): boolean {
  return existsSync(join(repo, rules.dir, "tsconfig.json")) && !modules.some((m) => /\.tsx?$/.test(m.source));
}

function typeScriptWarning(rules: Rules): Finding[] {
  const file = fromRoot(rules.dir, "tsconfig.json");
  const message = "no TypeScript files were read, so their imports went unchecked — dependency-cruiser needs `typescript` below 7 installed here";
  return [{ check: "architecture", level: "warn", file, message }];
}

/** One finding per broken rule: how often, and the first few places. */
export function summarize(violations: Violation[]): Finding[] {
  const byRule = new Map<string, Violation[]>();
  for (const violation of violations.filter((v) => v.rule.severity === "error" || v.rule.severity === "warn")) {
    byRule.set(violation.rule.name, [...(byRule.get(violation.rule.name) ?? []), violation]);
  }
  return [...byRule].map(([name, list]) => {
    const shown = list.slice(0, SHOWN_PER_RULE).map((v) => (v.from === v.to ? v.from : `${v.from} → ${v.to}`));
    const more = list.length > SHOWN_PER_RULE ? ` and ${list.length - SHOWN_PER_RULE} more` : "";
    return {
      check: "architecture",
      level: list[0].rule.severity === "error" ? "error" : "warn",
      file: list[0].from,
      message: `${name} (${list.length}): ${shown.join(", ")}${more}`,
    };
  });
}

export const architecture: Check = {
  id: "architecture",
  module: "architecture",
  description: "the repo keeps the import boundaries in its own .dependency-cruiser.cjs",
  run({ repo }) {
    const finding = (message: string, file?: string): Finding[] => [{ check: "architecture", level: "error", file, message }];
    const all = findRules(repo);
    if (all.length === 0) {
      return finding("no architecture rules — run `canon init --force --modules ...,architecture` for a starter, or write one", RULES_FILES[0]);
    }
    const bin = depcruiseBin(repo);
    if (!bin) return finding("dependency-cruiser is not installed here — add it as a devDependency (e.g. `pnpm add -D dependency-cruiser`)", "package.json");

    return all.flatMap((rules) => {
      const result = depcruise(repo, bin, rules, ["--output-type", "json"]);
      try {
        const cruise: { modules: Array<{ source: string }>; summary: { violations: Violation[] } } = JSON.parse(result.stdout);
        const violations = cruise.summary.violations.map((v) => ({ ...v, from: fromRoot(rules.dir, v.from), to: fromRoot(rules.dir, v.to) }));
        const ignored = ignoredBy(repo, violations.map((v) => v.from));
        const findings = summarize(violations.filter((v) => !ignored.has(v.from)));
        return unreadTypeScript(repo, rules, cruise.modules) ? [...findings, ...typeScriptWarning(rules)] : findings;
      } catch {
        const why = (result.error?.message ?? result.stderr).trim().split("\n").slice(-5).join(" ");
        return finding(`dependency-cruiser failed: ${why}`, fromRoot(rules.dir, rules.file));
      }
    });
  },
};

// The graph level is the repo's choice, kept where dependency-cruiser keeps it for its own high-level view.
function collapsePattern(dir: string, file: string): string {
  try {
    const config = createRequire(join(dir, "noop.js"))(join(dir, file));
    return config.options?.reporterOptions?.archi?.collapsePattern ?? DEFAULT_COLLAPSE;
  } catch {
    return DEFAULT_COLLAPSE;
  }
}

function graphOf(repo: string, bin: string, rules: Rules): string | undefined {
  const collapse = collapsePattern(join(repo, rules.dir), rules.file);
  // The graph shows the repo's own parts; npm packages would bury them (the rules still check npm imports).
  const ownCode = "^(?!(\\.\\./)*node_modules/)";
  const result = depcruise(repo, bin, rules, ["--output-type", "mermaid", "--collapse", collapse, "--include-only", ownCode]);
  if (result.status !== 0 || !result.stdout.trim()) return undefined;
  if (result.stdout.length > MERMAID_MAX_CHARS) {
    return "flowchart LR\n  too_big[\"Graph too large to draw — set a coarser reporterOptions.archi.collapsePattern\"]";
  }
  return result.stdout.trim();
}

/** The repo's architecture as markdown — one mermaid graph per rules file — or undefined when there is nothing to draw. */
export function architectureGraph(repo: string): string | undefined {
  const bin = depcruiseBin(repo);
  if (!bin) return undefined;
  const sections = findRules(repo).flatMap((rules) => {
    const graph = graphOf(repo, bin, rules);
    return graph ? [`## ${rules.dir === "." ? "Whole repo" : rules.dir}\n\n\`\`\`mermaid\n${graph}\n\`\`\``] : [];
  });
  return sections.length > 0 ? sections.join("\n\n") : undefined;
}
