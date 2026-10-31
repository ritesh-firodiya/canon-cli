import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { addPack, fetchPackDocs, listPacks } from "../src/packs/packs.ts";
import { makeTree } from "./helpers/fixture.ts";

const canon = () =>
  makeTree({
    "packs/expo/pack.yaml": "name: expo\ndescription: Expo\nkinds: [mobile]\nskill: expo-app\ndocs:\n  - https://docs.expo.dev/llms.txt\n",
    "packs/react/pack.yaml": "name: react\ndescription: React\nkinds: [web]\ndocs: [https://react.dev/llms.txt]\n",
  });

describe("listPacks", () => {
  test("reads every pack.yaml, sorted by name", () => {
    expect(listPacks(canon()).map((pack) => pack.name)).toEqual(["expo", "react"]);
  });

  test("a pack.yaml whose name differs from its folder is an error", () => {
    const root = makeTree({ "packs/expo/pack.yaml": "name: other\ndescription: x\nkinds: [web]\ndocs: []\n" });
    expect(() => listPacks(root)).toThrow(/expo.*other/);
  });
});

describe("addPack", () => {
  test("adds the pack to the product context.yaml, keeping its other keys and comments", () => {
    const repo = makeTree({ ".context/context.yaml": "# mine\nkind: mobile\n" });
    const result = addPack(repo, "expo", { canonRoot: canon() });
    expect(result).toEqual({ file: join(repo, ".context/context.yaml"), added: true });
    const text = readFileSync(join(repo, ".context/context.yaml"), "utf8");
    expect(text).toContain("# mine");
    expect(text).toMatch(/packs:\n\s+- expo/);
  });

  test("adding a pack twice changes nothing", () => {
    const repo = makeTree({ ".context/context.yaml": "packs: [expo]\n" });
    expect(addPack(repo, "expo", { canonRoot: canon() }).added).toBe(false);
  });

  test("an unknown pack names the ones that exist", () => {
    expect(() => addPack(makeTree({}), "vue", { canonRoot: canon() })).toThrow(/vue.*expo, react/);
  });

  test("a product with no context.yaml is told to run init", () => {
    expect(() => addPack(makeTree({}), "expo", { canonRoot: canon() })).toThrow(/canon init/);
  });
});

describe("fetchPackDocs", () => {
  test("saves each doc as markdown under the cache and indexes the folder once", async () => {
    const cache = makeTree({});
    const calls: string[][] = [];
    const [pack] = listPacks(canon());
    await fetchPackDocs(pack, {
      cacheDir: cache,
      fetchText: async (url) => `# docs from ${url}`,
      run: (command, args) => {
        calls.push([command, ...args]);
        return { status: 0, output: "" };
      },
    });
    const saved = join(cache, "packs/expo/docs.expo.dev-llms.md");
    expect(existsSync(saved)).toBe(true);
    expect(readFileSync(saved, "utf8")).toContain("docs from https://docs.expo.dev/llms.txt");
    expect(calls[0]).toEqual(["qmd", "collection", "add", join(cache, "packs/expo"), "--name", "pack-expo"]);
    expect(calls[1]).toEqual(["qmd", "context", "add", "qmd://pack-expo", "Expo — vendor docs index (expo pack)"]);
  });

  test("a failed download is an error naming the url", async () => {
    const [pack] = listPacks(canon());
    await expect(
      fetchPackDocs(pack, {
        cacheDir: makeTree({}),
        fetchText: async () => {
          throw new Error("HTTP 404");
        },
        run: () => ({ status: 0, output: "" }),
      }),
    ).rejects.toThrow(/docs\.expo\.dev.*404/);
  });

  test("an already-indexed collection is refreshed, not an error", async () => {
    const calls: string[][] = [];
    const [pack] = listPacks(canon());
    await fetchPackDocs(pack, {
      cacheDir: makeTree({}),
      fetchText: async () => "x",
      run: (command, args) => {
        calls.push([command, ...args]);
        return args[1] === "add" && args[0] === "collection" ? { status: 1, output: "Collection 'pack-expo' already exists" } : { status: 0, output: "" };
      },
    });
    expect(calls.map((call) => call.slice(1, 3).join(" "))).toEqual(["collection add", "update"]);
  });
});
