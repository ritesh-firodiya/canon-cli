import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { applyInit, detectExpoSdk, planInit } from "../src/init.ts";
import { makeTree } from "./helpers/fixture.ts";

const recorder = () => {
  const calls: string[][] = [];
  return { calls, run: (command: string, args: string[]) => void calls.push([command, ...args]) };
};

describe("detectExpoSdk", () => {
  test("reads the expo major version from package.json, root or apps/mobile", () => {
    expect(detectExpoSdk(makeTree({ "package.json": JSON.stringify({ dependencies: { expo: "~57.0.4" } }) }))).toBe(57);
    expect(detectExpoSdk(makeTree({ "apps/mobile/package.json": JSON.stringify({ dependencies: { expo: "^56.1.0" } }) }))).toBe(56);
    expect(detectExpoSdk(makeTree({ "package.json": "{}" }))).toBeUndefined();
  });
});

describe("planInit", () => {
  test("proposes the inferred kind, its modules, the expo sdk and the zeno version", () => {
    const repo = makeTree({ "app.config.ts": "", "package.json": JSON.stringify({ dependencies: { expo: "~57.0.0" } }) });
    const plan = planInit(repo, { zenoVersion: "0.4.0" });
    expect(plan.config).toEqual({
      zeno: "0.4.0",
      kind: "expo-app",
      modules: ["docs", "design", "knowledge", "metrics", "code", "listing"],
      expo: { sdk: 57 },
    });
  });

  test("lists only the .context files that are missing", () => {
    const repo = makeTree({ ".context/README.md": "mine", ".context/wiki/index.md": "mine" });
    const plan = planInit(repo, { zenoVersion: "0.4.0" });
    expect(plan.create).toEqual([
      ".context/tasks.md",
      ".context/raw/.gitkeep",
      ".context/features/index.md",
    ]);
  });

  test("answers override the inferred kind and modules", () => {
    const plan = planInit(makeTree({}), { zenoVersion: "1", kind: "web", modules: ["docs"] });
    expect(plan.config.kind).toBe("web");
    expect(plan.config.modules).toEqual(["docs"]);
  });

  test("an existing zeno.yaml blocks init unless forced", () => {
    const repo = makeTree({ ".claude/zeno.yaml": "kind: web\n" });
    expect(() => planInit(repo, { zenoVersion: "1" })).toThrow(/already set up/);
    expect(() => planInit(repo, { zenoVersion: "1", force: true })).not.toThrow();
  });
});

describe("applyInit", () => {
  test("writes zeno.yaml, creates missing files without touching existing ones, and indexes knowledge", () => {
    const repo = makeTree({ ".context/README.md": "mine", ".context/wiki/index.md": "mine" });
    const plan = planInit(repo, { zenoVersion: "0.4.0", kind: "content", modules: ["docs", "knowledge"] });
    const { calls, run } = recorder();
    applyInit(repo, plan, { run, name: "demo" });

    expect(parse(readFileSync(join(repo, ".claude/zeno.yaml"), "utf8"))).toEqual(plan.config);
    expect(readFileSync(join(repo, ".context/README.md"), "utf8")).toBe("mine");
    expect(readFileSync(join(repo, ".context/tasks.md"), "utf8")).toMatch(/^---\nupdated: /);
    expect(existsSync(join(repo, ".context/raw/.gitkeep"))).toBe(true);
    expect(calls).toEqual([
      ["qmd", "collection", "add", join(repo, ".context/wiki"), "--name", "demo-wiki"],
      ["qmd", "collection", "add", join(repo, ".context/features"), "--name", "demo-features"],
    ]);
  });

  test("without the knowledge module nothing is indexed", () => {
    const repo = makeTree({});
    const { calls, run } = recorder();
    applyInit(repo, planInit(repo, { zenoVersion: "1", kind: "content", modules: ["docs"] }), { run, name: "demo" });
    expect(calls).toEqual([]);
  });
});
