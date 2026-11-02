import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import { buildBand } from "../src/band/band.ts";
import { pluginCommand, readUserFeatures, setFeature, setUserFeature } from "../src/features/features.ts";
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

  test("nothing else in the file is reformatted, however long its lines", () => {
    const long = "x".repeat(200);
    const text = `# note\ncanon: 2.0.0\npipelines:\n  default:\n    - { id: a, by: agent, done: [.context/a], prompt: "${long}" }\n    - id: b\n      prompt: ${long}\n`;
    const repo = makeTree({ ".context/context.yaml": text });
    setFeature(repo, "process", true);
    expect(readFileSync(file(repo), "utf8")).toBe(`${text}features:\n  - process\n`);
    setFeature(repo, "process", false);
    expect(readFileSync(file(repo), "utf8")).toBe(text);
  });

  test("a list in the middle of the file, in either form, changes in place", () => {
    const repo = makeTree({ ".context/context.yaml": "kind: package\nfeatures: [routing]\ncap: 3\n" });
    setFeature(repo, "styles", true);
    expect(readFileSync(file(repo), "utf8")).toBe("kind: package\nfeatures:\n  - routing\n  - styles\ncap: 3\n");
    setFeature(repo, "routing", false);
    expect(readFileSync(file(repo), "utf8")).toBe("kind: package\nfeatures:\n  - styles\ncap: 3\n");
  });

  test("a file with no last line break still gets a clean field", () => {
    const repo = makeTree({ ".context/context.yaml": "kind: package" });
    setFeature(repo, "styles", true);
    expect(readFileSync(file(repo), "utf8")).toBe("kind: package\nfeatures:\n  - styles\n");
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

  test("--user turns a feature on across the machine, in any repo and outside one, and off again", () => {
    process.env.CANON_HOME = makeTree({});
    const repo = makeTree({ ".context/context.yaml": "features: [process]\n" });
    expect(buildBand(makeTree({}), { canonRoot: "/x" }).features).toEqual([]);
    expect(setUserFeature("routing", true)).toEqual(["routing"]);
    expect(setUserFeature("routing", true)).toEqual(["routing"]);
    expect(buildBand(makeTree({}), { canonRoot: "/x" }).features).toEqual(["routing"]);
    expect(buildBand(repo, { canonRoot: "/x" }).features).toEqual(["process", "routing"]);
    expect(setUserFeature("routing", false)).toEqual([]);
    expect(buildBand(repo, { canonRoot: "/x" }).features).toEqual(["process"]);
  });

  test("--user refuses an unknown feature, and a broken file counts as nothing on", () => {
    const home = makeTree({ "features.json": "{broken" });
    process.env.CANON_HOME = home;
    expect(readUserFeatures()).toEqual([]);
    expect(() => setUserFeature("search", true)).toThrow(/unknown feature/);
  });

  test("--user installs a feature's plugin for the user, not the repo", () => {
    expect(pluginCommand("process", true, "user")).toEqual(["plugin", "install", "canon-process@canon", "--scope", "user"]);
  });

  test("a config that does not parse is left alone", () => {
    const text = "features: [broken\n";
    const repo = makeTree({ ".context/context.yaml": text });
    expect(() => setFeature(repo, "routing", true)).toThrow(/context\.yaml/);
    expect(readFileSync(file(repo), "utf8")).toBe(text);
  });
});
