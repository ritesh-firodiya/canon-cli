import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { HOOK, installHook } from "../src/commands/hooks.ts";
import { makeTree } from "./helpers/fixture.ts";

function repo(files: Record<string, string>): string {
  const root = makeTree(files);
  execFileSync("git", ["init", "-q"], { cwd: root });
  return root;
}

describe("installHook", () => {
  test("writes an executable pre-push hook that runs zeno check", () => {
    const root = repo({ ".context/tasks.md": "# Tasks\n" });
    expect(installHook(root)).toMatch(/^installed/);
    const hook = join(root, ".git/hooks/pre-push");
    expect(readFileSync(hook, "utf8")).toBe(HOOK);
    expect(statSync(hook).mode & 0o111).not.toBe(0);
  });

  test("replaces a hook the old estate script wrote, but never someone else's", () => {
    const old = repo({ ".context/tasks.md": "" });
    writeFileSync(join(old, ".git/hooks/pre-push"), "#!/bin/sh\n# installed by ~/git/bin/install-hooks\n");
    expect(installHook(old)).toMatch(/^installed/);
    const theirs = repo({ ".context/tasks.md": "" });
    writeFileSync(join(theirs, ".git/hooks/pre-push"), "#!/bin/sh\nnpm test\n");
    expect(installHook(theirs)).toMatch(/^SKIPPED.*not zeno's/);
    expect(readFileSync(join(theirs, ".git/hooks/pre-push"), "utf8")).toBe("#!/bin/sh\nnpm test\n");
  });

  test("a husky repo gets .husky/pre-push; a repo without tasks.md gets nothing", () => {
    const husky = repo({ ".context/tasks.md": "", ".husky/_/h": "" });
    execFileSync("git", ["config", "core.hooksPath", ".husky/_"], { cwd: husky });
    expect(installHook(husky)).toMatch(/\.husky\/pre-push — a tracked file/);
    const bare = repo({ "README.md": "" });
    expect(installHook(bare)).toMatch(/^skipped/);
    expect(existsSync(join(bare, ".git/hooks/pre-push"))).toBe(false);
  });
});
