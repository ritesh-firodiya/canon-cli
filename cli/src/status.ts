import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config/load.ts";
import { runChecks, type RunOptions } from "./run.ts";

export function zenoVersion(zenoRoot: string): string {
  const manifest = join(zenoRoot, ".claude-plugin", "plugin.json");
  if (!existsSync(manifest)) return "unknown";
  return JSON.parse(readFileSync(manifest, "utf8")).version ?? "unknown";
}

export function buildStatus(repo: string, options: RunOptions): string {
  const { config, sources } = loadConfig(repo, { estateRoot: options.estateRoot });
  const report = runChecks(repo, options);
  const errors = report.findings.filter((f) => f.level === "error").length;
  const warnings = report.findings.length - errors;
  const configLine =
    sources.length === 0
      ? "none — inferred; run `zeno init`"
      : sources.map((source) => `${source.layer} ${source.path}`).join("\n         ");
  return [
    `zeno ${zenoVersion(options.zenoRoot)}  ·  ${report.name}`,
    `kind     ${config.kind}`,
    `modules  ${config.modules.join(", ")}`,
    `config   ${configLine}`,
    `checks   ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`,
  ].join("\n");
}
