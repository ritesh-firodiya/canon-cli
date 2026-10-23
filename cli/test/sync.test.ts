import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { syncRepo } from "../src/sync.ts";
import { makeTree } from "./helpers/fixture.ts";

const zenoWith = (version: string) =>
  makeTree({
    ".claude-plugin/plugin.json": JSON.stringify({ version }),
    "packs/expo/pack.yaml": "name: expo\ndescription: Expo\nkinds: [expo-app]\ndocs: [https://docs.expo.dev/llms.txt]\n",
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
  test("refreshes the packs from estate and product, reindexes, and moves the pinned version", async () => {
    const estate = makeTree({ ".claude/zeno.yaml": "packs: [react]\n", "app/.claude/zeno.yaml": "# keep\nzeno: 0.3.0\npacks: [expo]\n" });
    const h = harness();
    const result = await syncRepo(join(estate, "app"), {
      zenoRoot: zenoWith("0.4.0"),
      estateRoot: estate,
      cacheDir: makeTree({}),
      run: h.run,
      fetchText: h.fetchText,
    });
    expect(h.fetched.sort()).toEqual(["https://docs.expo.dev/llms.txt", "https://react.dev/llms.txt"]);
    expect(h.calls.slice(-2)).toEqual([["qmd", "update"], ["qmd", "embed"]]);
    expect(result.version).toEqual({ from: "0.3.0", to: "0.4.0" });
    const yaml = readFileSync(join(estate, "app/.claude/zeno.yaml"), "utf8");
    expect(yaml).toContain("# keep");
    expect(yaml).toContain("zeno: 0.4.0");
  });

  test("a repo already on the current version is left alone", async () => {
    const repo = makeTree({ ".claude/zeno.yaml": "zeno: 0.4.0\n" });
    const h = harness();
    const result = await syncRepo(repo, { zenoRoot: zenoWith("0.4.0"), estateRoot: repo, cacheDir: makeTree({}), run: h.run, fetchText: h.fetchText });
    expect(result.version).toBeNull();
  });

  test("a repo with no zeno.yaml is told to run init", async () => {
    const h = harness();
    await expect(
      syncRepo(makeTree({}), { zenoRoot: zenoWith("1"), estateRoot: "/none", cacheDir: makeTree({}), run: h.run, fetchText: h.fetchText }),
    ).rejects.toThrow(/zeno init/);
  });
});
