import { describe, expect, test } from "vitest";
import { findEstate, loadConfig } from "../src/config/load.ts";
import { kindCovers } from "../src/config/schema.ts";
import { makeTree } from "./helpers/fixture.ts";

describe("loadConfig", () => {
  test("infers kind mobile from app.config.ts when there is no canon.yaml", () => {
    const repo = makeTree({ "app.config.ts": "export default {}" });
    const { config } = loadConfig(repo);
    expect(config.kind).toBe("mobile");
    expect(config.modules).toContain("code");
    expect(config.modules).not.toContain("design");
    expect(config.modules).not.toContain("metrics");
  });

  test("infers kind web from next.config and content when there is no code", () => {
    expect(loadConfig(makeTree({ "next.config.ts": "" })).config.kind).toBe("web");
    expect(loadConfig(makeTree({ "README.md": "" })).config.kind).toBe("content");
  });

  test("infers kind package from a public package.json that ships a CLI or library", () => {
    expect(loadConfig(makeTree({ "package.json": JSON.stringify({ name: "x", bin: { x: "cli.js" } }) })).config.kind).toBe("package");
    expect(loadConfig(makeTree({ "package.json": JSON.stringify({ name: "x", private: true, bin: { x: "cli.js" } }) })).config.kind).toBe("content");
  });

  test("a repo that ships mobile and web counts as both", () => {
    expect(kindCovers("mobile-and-web", "mobile")).toBe(true);
    expect(kindCovers("mobile-and-web", "web")).toBe(true);
    expect(kindCovers("web", "mobile")).toBe(false);
  });

  test("finds the app inside a monorepo's apps/ folder", () => {
    expect(loadConfig(makeTree({ "apps/web/next.config.ts": "" })).config.kind).toBe("web");
    expect(loadConfig(makeTree({ "apps/mobile/app.config.ts": "", "apps/web/next.config.ts": "" })).config.kind).toBe("mobile-and-web");
  });

  test("a repo with .context/designs gets the design module even when inferred as content", () => {
    const { config } = loadConfig(makeTree({ ".context/designs/mobile/routes.js": "" }));
    expect(config.kind).toBe("content");
    expect(config.modules).toContain("design");
  });

  test("product canon.yaml overrides the inferred defaults", () => {
    const repo = makeTree({
      "app.config.ts": "",
      ".claude/canon.yaml": "kind: web\nmodules: [docs]\nexpo:\n  sdk: 57\n",
    });
    const { config, sources } = loadConfig(repo);
    expect(config.kind).toBe("web");
    expect(config.modules).toEqual(["docs"]);
    expect(config.expo?.sdk).toBe(57);
    expect(sources).toHaveLength(1);
  });

  test("layers merge estate, then product, then local — later wins", () => {
    const estate = makeTree({
      ".claude/canon.yaml": "estate: true\nweigh:\n  weights:\n    C-07: 2\n    C-15: 1\n",
      "app/.claude/canon.yaml": "weigh:\n  weights:\n    C-15: 3\n",
      "app/.claude/canon.local.yaml": "weigh:\n  weights:\n    C-07: 0.5\n",
      "app/app.config.ts": "",
    });
    const { config, sources } = loadConfig(`${estate}/app`, { estateRoot: estate });
    expect(config.weigh.weights).toEqual({ "C-07": 0.5, "C-15": 3 });
    expect(sources.map((s) => s.layer)).toEqual(["estate", "product", "local"]);
  });

  test("a later layer's list replaces an earlier one instead of joining it", () => {
    const estate = makeTree({
      ".claude/canon.yaml": "modules: [docs, design, listing]\n",
      "app/.claude/canon.yaml": "modules: [docs]\n",
    });
    expect(loadConfig(`${estate}/app`, { estateRoot: estate }).config.modules).toEqual(["docs"]);
  });

  test("packs add up across layers — a global pack applies to every product", () => {
    const estate = makeTree({ ".claude/canon.yaml": "packs: [react]\n", "app/.claude/canon.yaml": "packs: [expo]\n" });
    expect(loadConfig(`${estate}/app`, { estateRoot: estate }).config.packs).toEqual(["expo", "react"]);
  });

  test("an unknown kind is a clear error naming the file", () => {
    const repo = makeTree({ ".claude/canon.yaml": "kind: desktop\n" });
    expect(() => loadConfig(repo)).toThrow(/canon\.yaml.*kind/s);
  });

  test("standards add up across layers, resolved from the folder that holds .claude/", () => {
    const estate = makeTree({
      ".claude/canon.yaml": "estate: true\nstandards: [rules]\n",
      "app/.claude/canon.yaml": "standards: [docs/rules]\n",
    });
    expect(loadConfig(`${estate}/app`, { estateRoot: estate }).config.standards).toEqual([
      `${estate}/rules`,
      `${estate}/app/docs/rules`,
    ]);
  });

  test("commands merge by id — a product replaces an estate command of the same id", () => {
    const estate = makeTree({
      ".claude/canon.yaml": "estate: true\ncommands:\n  - { id: designs, run: a }\n  - { id: lint, run: b }\n",
      "app/.claude/canon.yaml": "commands:\n  - { id: designs, run: c, if: x }\n",
    });
    expect(loadConfig(`${estate}/app`, { estateRoot: estate }).config.commands).toEqual([
      { id: "designs", run: "c", if: "x" },
      { id: "lint", run: "b" },
    ]);
  });

  test("wiki types and context folders add up across layers, merged by name", () => {
    const estate = makeTree({
      ".claude/canon.yaml":
        "estate: true\nwiki:\n  types:\n    - { type: bug, folder: bugs, reason: postmortems, sections: [Summary] }\ncontext:\n  folders:\n    - { folder: research, reason: interviews }\n",
      "app/.claude/canon.yaml": "wiki:\n  types:\n    - { type: bug, folder: bug-reports, reason: renamed here, sections: [Summary, Fix] }\n",
    });
    const { config } = loadConfig(`${estate}/app`, { estateRoot: estate });
    expect(config.wiki.types).toEqual([{ type: "bug", folder: "bug-reports", reason: "renamed here", sections: ["Summary", "Fix"] }]);
    expect(config.context.folders).toEqual([{ folder: "research", reason: "interviews" }]);
  });

  test("the specs module is gone", () => {
    expect(() => loadConfig(makeTree({ ".claude/canon.yaml": "modules: [specs]\n" }))).toThrow(/modules/);
  });

  test("a wiki type or context folder needs a reason, and cannot redefine a built-in", () => {
    const load = (yaml: string) => () => loadConfig(makeTree({ ".claude/canon.yaml": yaml }));
    expect(load("wiki:\n  types:\n    - { type: bug, folder: bugs, sections: [Summary] }\n")).toThrow(/reason/);
    expect(load("wiki:\n  types:\n    - { type: bug, folder: bugs, reason: x }\n")).toThrow(/sections/);
    expect(load("wiki:\n  types:\n    - { type: bug, folder: bugs, reason: x, sections: [] }\n")).toThrow(/sections/);
    expect(load("context:\n  folders:\n    - { folder: research }\n")).toThrow(/reason/);
    expect(load("wiki:\n  types:\n    - { type: concept, folder: ideas, reason: x, sections: [Summary] }\n")).toThrow(/built-in/);
    expect(load("wiki:\n  types:\n    - { type: bug, folder: concepts, reason: x, sections: [Summary] }\n")).toThrow(/built-in/);
  });

  test("doctor tools merge by tool name", () => {
    const repo = makeTree({ ".claude/canon.yaml": "doctor:\n  tools:\n    - { tool: rtk, why: short output, hint: brew install rtk }\n" });
    expect(loadConfig(repo).config.doctor.tools).toEqual([{ tool: "rtk", why: "short output", hint: "brew install rtk" }]);
  });
});

describe("findEstate", () => {
  test("is the nearest folder above the start whose canon.yaml says estate: true", () => {
    const root = makeTree({
      ".claude/canon.yaml": "estate: true\n",
      "group/.claude/canon.yaml": "kind: web\n",
      "group/app/README.md": "",
    });
    expect(findEstate(`${root}/group/app`)).toBe(root);
  });

  test("is null when no folder above is marked", () => {
    expect(findEstate(makeTree({ "app/README.md": "" }) + "/app")).toBeNull();
  });

  test("a product with no estate gets only its own layers", () => {
    const root = makeTree({ "app/.claude/canon.yaml": "kind: web\n" });
    expect(loadConfig(`${root}/app`).sources.map((s) => s.layer)).toEqual(["product"]);
  });
});

