import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../../config/load.ts";
import type { Config } from "../../config/schema.ts";
import { runChecks, type RunOptions } from "../checks/check.ts";

export function canonVersion(canonRoot: string): string {
  const manifest = join(canonRoot, ".claude-plugin", "plugin.json");
  if (!existsSync(manifest)) return "unknown";
  return JSON.parse(readFileSync(manifest, "utf8")).version ?? "unknown";
}

/** What this repo turned off compared with canon's defaults and the layers it extends. It may; it cannot do it quietly. */
export function weakened(config: Config): string[] {
  const lines = Object.entries(config.baseline.pipelines).flatMap(([name, baseline]) => {
    const own = config.pipelines[name] ?? [];
    return baseline.flatMap((stage) => {
      const mine = own.find((entry) => entry.id === stage.id);
      if (!mine) return [`${name}: stage ${stage.id} removed${stage.gate ? ", and its gate" : ""}`];
      return [
        ...(stage.gate && !mine.gate ? [`${name}: gate ${stage.id} removed`] : []),
        ...(stage.cap && mine.cap && mine.cap > stage.cap ? [`${name}: ${stage.id} cap raised from $${stage.cap} to $${mine.cap}`] : []),
      ];
    });
  });
  const cap = config.baseline.cap;
  return [...lines, ...(cap && config.cap && config.cap > cap ? [`cap raised from $${cap} to $${config.cap}`] : [])];
}

/** Where the force comes from here: a hook can be skipped, and a required CI job needs a repo admin to get round. */
export function enforcement(repo: string): string[] {
  const hook = join(repo, ".git", "hooks", "pre-push");
  const hasHook = existsSync(hook) && readFileSync(hook, "utf8").includes("canon");
  const workflows = join(repo, ".github", "workflows");
  const hasCi = existsSync(workflows) && readdirSync(workflows).some((file) => readFileSync(join(workflows, file), "utf8").includes("canon") && readFileSync(join(workflows, file), "utf8").includes(" check"));
  return [...(hasHook ? [] : ["no pre-push hook: run canon hooks install"]), ...(hasCi ? [] : ["no CI job running canon check: nothing stops a push that skips the hook"])];
}

export function buildStatus(repo: string, options: RunOptions): string {
  const { config, sources } = loadConfig(repo);
  const report = runChecks(repo, options);
  const errors = report.findings.filter((f) => f.level === "error").length;
  const warnings = report.findings.length - errors;
  const configLine =
    sources.length === 0
      ? "none — inferred; run `canon init`"
      : sources.map((source) => `${source.layer} ${source.path}`).join("\n         ");
  return [
    `canon ${canonVersion(options.canonRoot)}  ·  ${report.name}`,
    `kind     ${config.kind}`,
    `modules  ${config.modules.join(", ")}`,
    `config   ${configLine}`,
    `checks   ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`,
    ...enforcement(repo).map((line) => `enforce  ${line}`),
    ...weakened(config).map((line) => `weaker   ${line}`),
  ].join("\n");
}
