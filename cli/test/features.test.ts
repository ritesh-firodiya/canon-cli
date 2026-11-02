import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import { pluginCommand, setFeature } from "../src/features/features.ts";
import { makeTree } from "./helpers/fixture.ts";

const file = (repo: string) => join(repo, ".context", "context.yaml");

describe("canon enable and disable", () => {
  test("a repo with no config gets one holding only the feature", () => {
    const repo = makeTree({});
    expect(setFeature(repo, "routing", true)).toEqual(["routing"]);
    expect(readFileSync(file(repo), "utf8")).toBe("features:\n  - routing\n");
    expect(loadConfig(repo).config.features).toEqual(["routing"]);
  });

  test("the rest of the file, comments included, is kept", () => {
    const repo = makeTree({ ".context/context.yaml": "# why this repo exists\nkind: package\ncap: 3 # dollars\n" });
    setFeature(repo, "process", true);
    const text = readFileSync(file(repo), "utf8");
    expect(text).toContain("# why this repo exists");
    expect(text).toContain("cap: 3 # dollars");
    expect(loadConfig(repo).config.features).toEqual(["process"]);
  });

  test("enabling twice adds it once, and disabling takes out only that one", () => {
    const repo = makeTree({});
    setFeature(repo, "routing", true);
    setFeature(repo, "routing", true);
    expect(setFeature(repo, "knowledge", true)).toEqual(["routing", "knowledge"]);
    expect(setFeature(repo, "routing", false)).toEqual(["knowledge"]);
  });

  test("disabling the last one removes the field, and disabling with no config writes nothing", () => {
    const repo = makeTree({ ".context/context.yaml": "kind: package\nfeatures: [routing]\n" });
    expect(setFeature(repo, "routing", false)).toEqual([]);
    expect(readFileSync(file(repo), "utf8")).toBe("kind: package\n");
    const empty = makeTree({});
    expect(setFeature(empty, "routing", false)).toEqual([]);
    expect(existsSync(file(empty))).toBe(false);
  });

  test("an unknown feature is refused, and names the ones there are", () => {
    expect(() => setFeature(makeTree({}), "search", true)).toThrow(/unknown feature "search" — choose from: routing, process, knowledge, styles/);
  });

  test("each feature with a plugin changes it for this repo only, and routing has none", () => {
    expect(pluginCommand("process", true)).toEqual(["plugin", "install", "canon-process@canon", "--scope", "project"]);
    expect(pluginCommand("knowledge", false)).toEqual(["plugin", "uninstall", "canon-knowledge@canon", "--scope", "project"]);
    expect(pluginCommand("styles", true)?.[2]).toBe("canon-styles@canon");
    expect(pluginCommand("routing", true)).toBeNull();
  });

  test("a config that does not parse is left alone", () => {
    const text = "features: [broken\n";
    const repo = makeTree({ ".context/context.yaml": text });
    expect(() => setFeature(repo, "routing", true)).toThrow(/context\.yaml/);
    expect(readFileSync(file(repo), "utf8")).toBe(text);
  });
});
