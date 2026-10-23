import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Check, Finding } from "./types.ts";

// The names dependency-cruiser itself looks for; `zeno init` writes the first.
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

function rulesFile(repo: string): string | undefined {
  return RULES_FILES.find((file) => existsSync(join(repo, file)));
}

// The repo's own pinned copy, never a global one, so every machine runs the same version.
function depcruiseBin(repo: string): string | undefined {
  const bin = join(repo, "node_modules", ".bin", "depcruise");
  return existsSync(bin) ? bin : undefined;
}

function depcruise(repo: string, bin: string, file: string, args: string[]) {
  return spawnSync(bin, [".", "--config", file, ...args], { cwd: repo, encoding: "utf8", maxBuffer: MAX_BUFFER });
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
    const file = rulesFile(repo);
    if (!file) {
      return finding("no architecture rules — run `zeno init --force --modules ...,architecture` for a starter, or write one", RULES_FILES[0]);
    }
    const bin = depcruiseBin(repo);
    if (!bin) return finding("dependency-cruiser is not installed here — add it as a devDependency (e.g. `pnpm add -D dependency-cruiser`)", "package.json");

    const result = depcruise(repo, bin, file, ["--output-type", "json"]);
    try {
      return summarize(JSON.parse(result.stdout).summary.violations);
    } catch {
      return finding(`dependency-cruiser failed: ${(result.error?.message ?? result.stderr).trim().split("\n").slice(-5).join(" ")}`, file);
    }
  },
};

// The graph level is the repo's choice, kept where dependency-cruiser keeps it for its own high-level view.
function collapsePattern(repo: string, file: string): string {
  try {
    const config = createRequire(join(repo, "noop.js"))(join(repo, file));
    return config.options?.reporterOptions?.archi?.collapsePattern ?? DEFAULT_COLLAPSE;
  } catch {
    return DEFAULT_COLLAPSE;
  }
}

/** The repo's architecture as a mermaid flowchart, or undefined when it has no rules or no dependency-cruiser. */
export function architectureGraph(repo: string): string | undefined {
  const file = rulesFile(repo);
  const bin = depcruiseBin(repo);
  if (!file || !bin) return undefined;
  const result = depcruise(repo, bin, file, ["--output-type", "mermaid", "--collapse", collapsePattern(repo, file)]);
  if (result.status !== 0 || !result.stdout.trim()) return undefined;
  if (result.stdout.length > MERMAID_MAX_CHARS) {
    return "flowchart LR\n  too_big[\"Graph too large to draw — set a coarser reporterOptions.archi.collapsePattern\"]";
  }
  return result.stdout.trim();
}
