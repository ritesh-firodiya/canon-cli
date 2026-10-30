import { existsSync } from "node:fs";
import { join, sep } from "node:path";
import type { CommandRunner } from "./packs.ts";
import { canonVersion } from "./status.ts";

export const PACKAGE = "@freetesh/canon";
const PLUGIN = "canon@canon";
const MARKETPLACE = "canon";

export interface UpdateOptions {
  canonRoot: string;
  run: CommandRunner;
  fetchText: (url: string) => Promise<string>;
}

/** Moves the canon CLI and its Claude Code plugin to the latest release; returns what it did, one line each. */
export async function updateCanon(options: UpdateOptions): Promise<string[]> {
  const { canonRoot, run } = options;
  const current = canonVersion(canonRoot);
  const latest = JSON.parse(await options.fetchText(`https://registry.npmjs.org/${PACKAGE}/latest`)).version as string;

  const lines: string[] = [];
  if (existsSync(join(canonRoot, ".git"))) {
    lines.push(`cli: running from a checkout at ${canonRoot} (${current}, latest ${latest}) — git pull there`);
  } else if (current === latest) {
    lines.push(`cli: ${current} is the latest`);
  } else {
    // A pnpm global install lives under pnpm's store; anything else came from npm.
    const [manager, ...args] = canonRoot.split(sep).includes("pnpm") ? ["pnpm", "add", "-g"] : ["npm", "install", "-g"];
    const result = run(manager, [...args, `${PACKAGE}@${latest}`]);
    if (result.status !== 0) throw new Error(`${manager} could not install ${PACKAGE}@${latest}:\n${result.output}`);
    lines.push(`cli: ${current} → ${latest}`);
  }

  run("claude", ["plugin", "marketplace", "update", MARKETPLACE]);
  const plugin = run("claude", ["plugin", "update", PLUGIN]);
  lines.push(plugin.status === 0 ? "plugin: updated — restart Claude Code to load it" : `plugin: not updated — ${plugin.output.trim().split("\n")[0]}`);
  return lines;
}
