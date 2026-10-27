import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { applyInit, architectureStarters, detectExpoSdk, parseChoices, planInit } from "../src/init.ts";
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

describe("parseChoices", () => {
  test("splits a comma list and keeps only known values", () => {
    expect(parseChoices("docs, code", ["docs", "code", "design"], "module")).toEqual(["docs", "code"]);
    expect(parseChoices("", ["docs"], "module")).toEqual([]);
  });

  test("an unknown value is an error that lists the allowed ones", () => {
    expect(() => parseChoices("docs,desgin", ["docs", "design"], "module")).toThrow(/unknown module "desgin" — choose from: docs, design/);
  });
});

describe("planInit", () => {
  test("proposes the inferred kind, its modules, the expo sdk and the canon version", () => {
    const repo = makeTree({ "app.config.ts": "", "package.json": JSON.stringify({ dependencies: { expo: "~57.0.0" } }) });
    const plan = planInit(repo, { canonVersion: "0.4.0" });
    expect(plan.config).toEqual({
      canon: "0.4.0",
      kind: "expo-app",
      modules: ["docs", "knowledge", "code", "listing", "refs"],
      expo: { sdk: 57 },
    });
  });

  test("design is proposed only when the repo already has designs", () => {
    const plan = planInit(makeTree({ "app.json": "{}", ".context/designs/mobile/index.html": "" }), { canonVersion: "1" });
    expect(plan.config.modules).toContain("design");
  });

  test("without docs or knowledge, no raw, wiki or features are created", () => {
    const plan = planInit(makeTree({}), { canonVersion: "1", kind: "web", modules: ["code"] });
    expect(plan.create).toEqual([".context/README.md", ".context/tasks.md"]);
  });

  test("chosen packs are written to the config; none means no packs key", () => {
    expect(planInit(makeTree({}), { canonVersion: "1", packs: ["expo", "firebase"] }).config.packs).toEqual(["expo", "firebase"]);
    expect(planInit(makeTree({}), { canonVersion: "1", packs: [] }).config).not.toHaveProperty("packs");
  });

  test("lists only the .context files that are missing", () => {
    const repo = makeTree({ ".context/README.md": "mine", ".context/wiki/index.md": "mine" });
    const plan = planInit(repo, { canonVersion: "0.4.0" });
    expect(plan.create).toEqual([
      ".context/tasks.md",
      ".context/raw/.gitkeep",
      ".context/features/index.md",
    ]);
  });

  test("answers override the inferred kind and modules", () => {
    const plan = planInit(makeTree({}), { canonVersion: "1", kind: "web", modules: ["docs"] });
    expect(plan.config.kind).toBe("web");
    expect(plan.config.modules).toEqual(["docs"]);
  });

  test("an existing canon.yaml blocks init unless forced", () => {
    const repo = makeTree({ ".claude/canon.yaml": "kind: web\n" });
    expect(() => planInit(repo, { canonVersion: "1" })).toThrow(/already set up/);
    expect(() => planInit(repo, { canonVersion: "1", force: true })).not.toThrow();
  });
});

describe("applyInit", () => {
  test("writes canon.yaml, creates missing files without touching existing ones, and indexes knowledge", () => {
    const repo = makeTree({ ".context/README.md": "mine", ".context/wiki/index.md": "mine" });
    const plan = planInit(repo, { canonVersion: "0.4.0", kind: "content", modules: ["docs", "knowledge"] });
    const { calls, run } = recorder();
    applyInit(repo, plan, { run, name: "demo", canonRoot: repo });

    expect(parse(readFileSync(join(repo, ".claude/canon.yaml"), "utf8"))).toEqual(plan.config);
    expect(readFileSync(join(repo, ".context/README.md"), "utf8")).toBe("mine");
    expect(readFileSync(join(repo, ".context/tasks.md"), "utf8")).toMatch(/^# Tasks\n\n## Now\n/);
    expect(existsSync(join(repo, ".context/raw/.gitkeep"))).toBe(true);
    expect(calls).toEqual([
      ["qmd", "collection", "add", join(repo, ".context/wiki"), "--name", "demo-wiki"],
      ["qmd", "collection", "add", join(repo, ".context/features"), "--name", "demo-features"],
    ]);
  });

  test("architecture in a monorepo: the managed base plus one starter per workspace, by kind", () => {
    const repo = makeTree({ "apps/web/package.json": "{}", "packages/ui/package.json": "{}", "packages/notes/README.md": "" });
    expect(architectureStarters(repo)).toEqual([
      { file: ".dependency-cruiser.base.cjs", template: "base.cjs" },
      { file: "apps/web/.dependency-cruiser.cjs", template: "app.cjs" },
      { file: "packages/ui/.dependency-cruiser.cjs", template: "package.cjs" },
    ]);
  });

  test("architecture in a single repo: the managed base plus one starter at the root", () => {
    expect(architectureStarters(makeTree({ "src/a.ts": "" })).map((s) => s.template)).toEqual(["base.cjs", "root.cjs"]);
  });

  test("init writes the starters from canon's templates and never over a repo's own rules", () => {
    const canon = makeTree({
      "templates/dependency-cruiser/base.cjs": "// base\n",
      "templates/dependency-cruiser/app.cjs": "// app\n",
      "templates/dependency-cruiser/package.cjs": "// package\n",
    });
    const repo = makeTree({ "apps/web/package.json": "{}", "packages/ui/package.json": "{}", "packages/ui/.dependency-cruiser.json": "{}" });
    const plan = planInit(repo, { canonVersion: "1", kind: "web", modules: ["architecture"] });
    expect(plan.create).toEqual([".context/README.md", ".context/tasks.md", ".dependency-cruiser.base.cjs", "apps/web/.dependency-cruiser.cjs"]);
    applyInit(repo, plan, { run: recorder().run, name: "demo", canonRoot: canon });
    expect(readFileSync(join(repo, ".dependency-cruiser.base.cjs"), "utf8")).toBe("// base\n");
    expect(readFileSync(join(repo, "apps/web/.dependency-cruiser.cjs"), "utf8")).toBe("// app\n");
  });

  test("without the knowledge module nothing is indexed", () => {
    const repo = makeTree({});
    const { calls, run } = recorder();
    applyInit(repo, planInit(repo, { canonVersion: "1", kind: "content", modules: ["docs"] }), { run, name: "demo", canonRoot: repo });
    expect(calls).toEqual([]);
  });
});
