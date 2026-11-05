import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { drift, namedPaths } from "../../src/enforce/checks/drift.ts";
import { makeTree, wikiPage } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const page = (verified: string, body: string) => wikiPage({ "last-verified": verified }, body);
const PAGE = ".context/wiki/decisions/retries.md";

/** A repo with `files` committed at `date`. */
function gitTree(files: Record<string, string>, date: string): string {
  const repo = makeTree(files);
  const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: repo, env, stdio: "ignore" });
  git("init", "-q");
  git("add", ".");
  git("commit", "-q", "-m", "x");
  return repo;
}

const run = (repo: string) => drift.run(contextFor(repo));

describe("drift", () => {
  test("a page whose named files exist and are unchanged passes", () => {
    const repo = gitTree({ "src/pricing.ts": "a", [PAGE]: page("2026-10-01", "Retries cap at 3 in `src/pricing.ts`.") }, "2026-09-01T00:00:00Z");
    expect(run(repo)).toEqual([]);
  });

  test("a named file changed after last-verified is a warning naming page and file", () => {
    const repo = gitTree({ "src/pricing.ts": "a", [PAGE]: page("2026-10-01", "Retries cap at 3 in `src/pricing.ts`.") }, "2026-10-10T00:00:00Z");
    expect(run(repo)).toEqual([
      expect.objectContaining({ level: "warn", file: PAGE, message: "the code changed after 2026-10-01: src/pricing.ts" }),
    ]);
  });

  test("a named file that no longer exists is an error", () => {
    const repo = gitTree({ [PAGE]: page("2026-10-01", "See `src/apply.ts`.") }, "2026-09-01T00:00:00Z");
    expect(run(repo)).toEqual([
      expect.objectContaining({ level: "error", file: PAGE, message: "a file no longer in the tree: src/apply.ts" }),
    ]);
  });

  test("a page verified after the last code change passes", () => {
    const repo = gitTree({ "src/pricing.ts": "a", [PAGE]: page("2026-10-20", "See `src/pricing.ts`.") }, "2026-10-10T00:00:00Z");
    expect(run(repo)).toEqual([]);
  });

  test("without git there is no history, so no warning", () => {
    const repo = makeTree({ "src/pricing.ts": "a", [PAGE]: page("2020-01-01", "See `src/pricing.ts`.") });
    expect(run(repo)).toEqual([]);
  });

  test("code blocks, .context/ self-references and extension-less folders are ignored", () => {
    const body = "See `.context/wiki/x.yaml` and `src/lib`.\n\n```\n`src/gone.ts`\n```\n";
    expect(run(makeTree({ [PAGE]: page("2026-10-01", body) }))).toEqual([]);
  });

  test("globs and brace lists are ignored", () => {
    const body = "Files `src/*.ts` and `src/{a,b}.ts` and `src/a?.ts`.";
    expect(run(makeTree({ [PAGE]: page("2026-10-01", body) }))).toEqual([]);
  });

  test("namedPaths keeps code paths, drops URLs/globs/no-extension tokens", () => {
    const body = "`src/a.ts` `https://x.com/a.js` `src/*.ts` `src/lib` `~/a/b.ts` `./a/b.ts` `git log/x.ts` `a/1.5` `docs/x.md`";
    expect(namedPaths(body)).toEqual(["src/a.ts"]);
  });
});
