import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Command } from "commander";
import { findProducts } from "../run.ts";
import { requireEstate, type Env } from "./env.ts";

const MARK = "installed by `canon hooks install`";
// Hooks written by the tools this command replaced (the estate script, then zeno); they are ours to overwrite.
const OLD_MARKS = [MARK, "installed by ~/git/bin/install-hooks", "installed by `zeno hooks install`"];

export const HOOK = `#!/bin/sh
# ${MARK} — run it again rather than editing this file.
# A machine without canon pushes unchecked, as it would without any hook.
command -v canon >/dev/null 2>&1 || exit 0
# The product is the folder that owns .git, not the folder being pushed from: a worktree shares these hooks.
root=$(cd "$(git rev-parse --git-common-dir)/.." && pwd) || exit 0
exec canon check "$root"
`;

const ours = (path: string) => OLD_MARKS.some((mark) => readFileSync(path, "utf8").includes(mark));

/** Writes the pre-push hook into one repo. Returns a one-line outcome. */
export function installHook(repo: string): string {
  if (!existsSync(join(repo, ".git"))) return `skipped: ${repo} is not a git repo`;
  if (!existsSync(join(repo, ".context", "tasks.md"))) {
    const old = join(repo, ".git", "hooks", "pre-push");
    if (existsSync(old) && ours(old)) {
      renameSync(old, `${old}.disabled`);
      return `disabled: ${repo} has no .context/tasks.md, so it would never pass`;
    }
    return `skipped: ${repo} has no .context/tasks.md`;
  }
  const hooksPath = spawnSync("git", ["-C", repo, "config", "core.hooksPath"], { encoding: "utf8" }).stdout.trim();
  // husky points core.hooksPath at .husky/_, whose stubs run .husky/<name>.
  const target = hooksPath === "" ? join(repo, ".git", "hooks", "pre-push") : hooksPath === ".husky/_" ? join(repo, ".husky", "pre-push") : null;
  if (!target) return `SKIPPED: ${repo} sets core.hooksPath=${hooksPath} — add the hook there by hand`;
  if (existsSync(target) && (lstatSync(target).isSymbolicLink() || !ours(target))) return `SKIPPED: ${target} exists and is not canon's`;
  writeFileSync(target, HOOK);
  chmodSync(target, 0o755);
  return target.includes("/.husky/") ? `installed: ${target} — a tracked file, commit it` : `installed: ${target}`;
}

export function registerHooks(program: Command, env: Env): void {
  program
    .command("hooks")
    .description("install a pre-push hook that runs `canon check`")
    .argument("<action>", "install")
    .argument("[repo]", "product repo", ".")
    .option("--all", "every product in the estate")
    .action((action: string, repo: string, options: { all?: boolean }) => {
      if (action !== "install") throw new Error(`unknown action ${action} — use: canon hooks install`);
      const repos = options.all ? findProducts(requireEstate(env)) : [resolve(repo)];
      for (const path of repos) console.log(`  ${installHook(path)}`);
    });
}
