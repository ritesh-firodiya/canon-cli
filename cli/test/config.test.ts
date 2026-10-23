import { describe, expect, test } from "vitest";
import { findEstate, loadConfig } from "../src/config/load.ts";
import { makeTree } from "./helpers/fixture.ts";

describe("loadConfig", () => {
  test("infers kind expo-app from app.config.ts when there is no zeno.yaml", () => {
    const repo = makeTree({ "app.config.ts": "export default {}" });
    const { config } = loadConfig(repo);
    expect(config.kind).toBe("expo-app");
    expect(config.modules).toContain("code");
    expect(config.modules).not.toContain("design");
  });

  test("infers kind web from next.config and content when there is no code", () => {
    expect(loadConfig(makeTree({ "next.config.ts": "" })).config.kind).toBe("web");
    expect(loadConfig(makeTree({ "README.md": "" })).config.kind).toBe("content");
  });

  test("finds the app inside a monorepo's apps/ folder", () => {
    expect(loadConfig(makeTree({ "apps/web/next.config.ts": "" })).config.kind).toBe("web");
    expect(loadConfig(makeTree({ "apps/mobile/app.config.ts": "", "apps/web/next.config.ts": "" })).config.kind).toBe("expo-app");
  });

  test("a repo with .context/designs gets the design module even when inferred as content", () => {
    const { config } = loadConfig(makeTree({ ".context/designs/mobile/routes.js": "" }));
    expect(config.kind).toBe("content");
    expect(config.modules).toContain("design");
  });

  test("product zeno.yaml overrides the inferred defaults", () => {
    const repo = makeTree({
      "app.config.ts": "",
      ".claude/zeno.yaml": "kind: web\nmodules: [docs]\nexpo:\n  sdk: 57\n",
    });
    const { config, sources } = loadConfig(repo);
    expect(config.kind).toBe("web");
    expect(config.modules).toEqual(["docs"]);
    expect(config.expo?.sdk).toBe(57);
    expect(sources).toHaveLength(1);
  });

  test("layers merge estate, then product, then local — later wins", () => {
    const estate = makeTree({
      ".claude/zeno.yaml": "estate: true\nweigh:\n  weights:\n    C-07: 2\n    C-15: 1\n",
      "app/.claude/zeno.yaml": "weigh:\n  weights:\n    C-15: 3\n",
      "app/.claude/zeno.local.yaml": "weigh:\n  weights:\n    C-07: 0.5\n",
      "app/app.config.ts": "",
    });
    const { config, sources } = loadConfig(`${estate}/app`, { estateRoot: estate });
    expect(config.weigh.weights).toEqual({ "C-07": 0.5, "C-15": 3 });
    expect(sources.map((s) => s.layer)).toEqual(["estate", "product", "local"]);
  });

  test("a later layer's list replaces an earlier one instead of joining it", () => {
    const estate = makeTree({
      ".claude/zeno.yaml": "modules: [docs, design, listing]\n",
      "app/.claude/zeno.yaml": "modules: [docs]\n",
    });
    expect(loadConfig(`${estate}/app`, { estateRoot: estate }).config.modules).toEqual(["docs"]);
  });

  test("packs add up across layers — a global pack applies to every product", () => {
    const estate = makeTree({ ".claude/zeno.yaml": "packs: [react]\n", "app/.claude/zeno.yaml": "packs: [expo]\n" });
    expect(loadConfig(`${estate}/app`, { estateRoot: estate }).config.packs).toEqual(["expo", "react"]);
  });

  test("turning a check off without a reason is rejected", () => {
    const repo = makeTree({ ".claude/zeno.yaml": "checks:\n  stale-copies:\n    enabled: false\n" });
    expect(() => loadConfig(repo)).toThrow(/reason/);
  });

  test("turning a check off with a reason is kept as an override", () => {
    const repo = makeTree({
      ".claude/zeno.yaml": "checks:\n  stale-copies:\n    enabled: false\n    reason: cursor still used here\n",
    });
    expect(loadConfig(repo).config.checks["stale-copies"]).toEqual({
      enabled: false,
      reason: "cursor still used here",
    });
  });

  test("an unknown kind is a clear error naming the file", () => {
    const repo = makeTree({ ".claude/zeno.yaml": "kind: desktop\n" });
    expect(() => loadConfig(repo)).toThrow(/zeno\.yaml.*kind/s);
  });

  test("standards add up across layers, resolved from the folder that holds .claude/", () => {
    const estate = makeTree({
      ".claude/zeno.yaml": "estate: true\nstandards: [rules]\n",
      "app/.claude/zeno.yaml": "standards: [docs/rules]\n",
    });
    expect(loadConfig(`${estate}/app`, { estateRoot: estate }).config.standards).toEqual([
      `${estate}/rules`,
      `${estate}/app/docs/rules`,
    ]);
  });

  test("commands merge by id — a product replaces an estate command of the same id", () => {
    const estate = makeTree({
      ".claude/zeno.yaml": "estate: true\ncommands:\n  - { id: designs, run: a }\n  - { id: lint, run: b }\n",
      "app/.claude/zeno.yaml": "commands:\n  - { id: designs, run: c, if: x }\n",
    });
    expect(loadConfig(`${estate}/app`, { estateRoot: estate }).config.commands).toEqual([
      { id: "designs", run: "c", if: "x" },
      { id: "lint", run: "b" },
    ]);
  });

  test("doctor tools merge by tool name", () => {
    const repo = makeTree({ ".claude/zeno.yaml": "doctor:\n  tools:\n    - { tool: rtk, why: short output, hint: brew install rtk }\n" });
    expect(loadConfig(repo).config.doctor.tools).toEqual([{ tool: "rtk", why: "short output", hint: "brew install rtk" }]);
  });
});

describe("findEstate", () => {
  test("is the nearest folder above the start whose zeno.yaml says estate: true", () => {
    const root = makeTree({
      ".claude/zeno.yaml": "estate: true\n",
      "group/.claude/zeno.yaml": "kind: web\n",
      "group/app/README.md": "",
    });
    expect(findEstate(`${root}/group/app`)).toBe(root);
  });

  test("is null when no folder above is marked", () => {
    expect(findEstate(makeTree({ "app/README.md": "" }) + "/app")).toBeNull();
  });

  test("a product with no estate gets only its own layers", () => {
    const root = makeTree({ "app/.claude/zeno.yaml": "kind: web\n" });
    expect(loadConfig(`${root}/app`).sources.map((s) => s.layer)).toEqual(["product"]);
  });
});

