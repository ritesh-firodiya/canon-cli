import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { expect, test } from "vitest";

// canon is public: it never names a product it happens to sit next to. The names are the
// sibling repos, so none is written here, and CI (no siblings) skips the test.
const REPO = resolve(import.meta.dirname, "../..");
const COMMON = new Set([basename(REPO), "canon", "babul", "ritesh-firodiya", "ritesh-firodiya.github.io"]);
// shortcut: evals still run on real product snapshots; drop this once they move out of the repo.
const SKIP = /^evals\//;

const siblings = readdirSync(dirname(REPO)).filter((name) => !COMMON.has(name) && existsSync(join(dirname(REPO), name, ".git")));

test.skipIf(siblings.length === 0)("no tracked file names a sibling product", () => {
  const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\w-])(${siblings.map(escape).join("|")})(?![\\w-])`, "i");
  const files = execFileSync("git", ["ls-files"], { cwd: REPO, encoding: "utf8" }).split("\n").filter((file) => file && !SKIP.test(file));
  const hits = files.flatMap((file) =>
    readFileSync(join(REPO, file), "utf8").split("\n").flatMap((line, i) => (pattern.test(line) ? [`${file}:${i + 1}: ${line.trim().slice(0, 100)}`] : [])),
  );
  expect(hits).toEqual([]);
});
