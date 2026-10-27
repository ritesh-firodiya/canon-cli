import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { syncRepo } from "../src/sync.ts";
import { makeTree } from "./helpers/fixture.ts";

const canonWith = (version: string) =>
  makeTree({
    ".claude-plugin/plugin.json": JSON.stringify({ version }),
    "packs/expo/pack.yaml": "name: expo\ndescription: Expo\nkinds: [mobile]\ndocs: [https://docs.expo.dev/llms.txt]\n",
    "packs/react/pack.yaml": "name: react\ndescription: React\nkinds: [web]\ndocs: [https://react.dev/llms.txt]\n",
  });

function harness() {
  const calls: string[][] = [];
  const fetched: string[] = [];
  return {
    calls,
    fetched,
    run: (command: string, args: string[]) => {
      calls.push([command, ...args]);
      return { status: 0, output: "" };
    },
    fetchText: async (url: string) => {
      fetched.push(url);
      return "docs";
    },
  };
}

describe("syncRepo", () => {
  test("refreshes the repo's packs, reindexes, and moves the pinned version", async () => {
    const root = makeTree({ "app/.claude/canon.yaml": "# keep\ncanon: 0.3.0\npacks: [expo, react]\n" });
    const h = harness();
    const result = await syncRepo(join(root, "app"), {
      canonRoot: canonWith("0.4.0"),
      cacheDir: makeTree({}),
      run: h.run,
      fetchText: h.fetchText,
    });
    expect(h.fetched.sort()).toEqual(["https://docs.expo.dev/llms.txt", "https://react.dev/llms.txt"]);
    expect(h.calls.slice(-2)).toEqual([["qmd", "update"], ["qmd", "embed"]]);
    expect(result.version).toEqual({ from: "0.3.0", to: "0.4.0" });
    const yaml = readFileSync(join(root, "app/.claude/canon.yaml"), "utf8");
    expect(yaml).toContain("# keep");
    expect(yaml).toContain("canon: 0.4.0");
  });

  test("a repo already on the current version is left alone", async () => {
    const repo = makeTree({ ".claude/canon.yaml": "canon: 0.4.0\n" });
    const h = harness();
    const result = await syncRepo(repo, { canonRoot: canonWith("0.4.0"), cacheDir: makeTree({}), run: h.run, fetchText: h.fetchText });
    expect(result.version).toBeNull();
  });

  test("indexes the repo's wiki and features before reindexing, so a late qmd install still finds them", async () => {
    const repo = makeTree({ ".claude/canon.yaml": "canon: 0.4.0\nkind: content\nmodules: [knowledge]\n" });
    const h = harness();
    await syncRepo(repo, { canonRoot: canonWith("0.4.0"), cacheDir: makeTree({}), run: h.run, fetchText: h.fetchText });
    const name = repo.split("/").pop();
    expect(h.calls).toEqual([
      ["qmd", "collection", "add", join(repo, ".context", "wiki"), "--name", `${name}-wiki`],
      ["qmd", "collection", "add", join(repo, ".context", "features"), "--name", `${name}-features`],
      ["qmd", "update"],
      ["qmd", "embed"],
    ]);
  });

  test("rewrites a drifted architecture base from canon's template, and leaves a current one alone", async () => {
    const canon = makeTree({ ".claude-plugin/plugin.json": JSON.stringify({ version: "1" }), "templates/dependency-cruiser/base.cjs": "// v2\n" });
    const drifted = makeTree({ ".claude/canon.yaml": "canon: \"1\"\n", ".dependency-cruiser.base.cjs": "// v1, edited\n" });
    const h = harness();
    const result = await syncRepo(drifted, { canonRoot: canon, cacheDir: makeTree({}), run: h.run, fetchText: h.fetchText });
    expect(result.base).toBe(true);
    expect(readFileSync(join(drifted, ".dependency-cruiser.base.cjs"), "utf8")).toBe("// v2\n");
    const current = await syncRepo(drifted, { canonRoot: canon, cacheDir: makeTree({}), run: h.run, fetchText: h.fetchText });
    expect(current.base).toBe(false);
  });

  test("a repo without an architecture base is not given one by sync", async () => {
    const canon = makeTree({ ".claude-plugin/plugin.json": JSON.stringify({ version: "1" }), "templates/dependency-cruiser/base.cjs": "// v2\n" });
    const repo = makeTree({ ".claude/canon.yaml": "canon: \"1\"\n" });
    const h = harness();
    expect((await syncRepo(repo, { canonRoot: canon, cacheDir: makeTree({}), run: h.run, fetchText: h.fetchText })).base).toBe(false);
  });

  test("a repo with no canon.yaml is told to run init", async () => {
    const h = harness();
    await expect(
      syncRepo(makeTree({}), { canonRoot: canonWith("1"), cacheDir: makeTree({}), run: h.run, fetchText: h.fetchText }),
    ).rejects.toThrow(/canon init/);
  });
});
