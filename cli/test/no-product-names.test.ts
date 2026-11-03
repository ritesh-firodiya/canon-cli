import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { expect, test } from "vitest";

// canon is public: it never names a product it happens to sit next to. The names are the
// sibling repos, so none is written here, and CI (no siblings) skips the test.
const REPO = resolve(import.meta.dirname, "../..");
// Knowledge repos (the context layers, personal records) are not products, and their names are common words.
const COMMON = new Set([basename(REPO), "canon", "babul", "ritesh-firodiya", "ritesh-firodiya.github.io", "context", "context-restricted", "documents"]);

// A product is a repo with a canon config, beside this one or one level down in an organization's folder.
const isProduct = (dir: string) => existsSync(join(dir, ".git")) && existsSync(join(dir, ".context", "context.yaml"));
const folders = (dir: string) => readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(dir, entry.name));
const siblings = [
  ...new Set(
    folders(dirname(REPO))
      .flatMap((dir) => (existsSync(join(dir, ".git")) ? [dir] : folders(dir)))
      .filter(isProduct)
      .map((dir) => basename(dir)),
  ),
].filter((name) => !COMMON.has(name));

test.skipIf(siblings.length === 0)("no tracked file names a sibling product", () => {
  const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\w-])(${siblings.map(escape).join("|")})(?![\\w-])`, "i");
  const files = execFileSync("git", ["ls-files"], { cwd: REPO, encoding: "utf8" }).split("\n").filter((file) => file);
  const hits = files.flatMap((file) =>
    readFileSync(join(REPO, file), "utf8").split("\n").flatMap((line, i) => (pattern.test(line) ? [`${file}:${i + 1}: ${line.trim().slice(0, 100)}`] : [])),
  );
  expect(hits).toEqual([]);
});
