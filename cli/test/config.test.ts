import { describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import { kindCovers } from "../src/config/schema.ts";
import { makeTree } from "./helpers/fixture.ts";

describe("loadConfig", () => {
  test("infers kind mobile from app.config.ts when there is no context.yaml", () => {
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

  test("product context.yaml overrides the inferred defaults", () => {
    const repo = makeTree({
      "app.config.ts": "",
      ".context/context.yaml": "kind: web\nmodules: [docs]\nexpo:\n  sdk: 57\n",
    });
    const { config, sources } = loadConfig(repo);
    expect(config.kind).toBe("web");
    expect(config.modules).toEqual(["docs"]);
    expect(config.expo?.sdk).toBe(57);
    expect(sources).toHaveLength(1);
  });

  test("a repo names the space (product) it is part of; a bad name is refused", () => {
    expect(loadConfig(makeTree({ ".context/context.yaml": "kind: package\nspace: canon\n" })).config.space).toBe("canon");
    expect(loadConfig(makeTree({ ".context/context.yaml": "kind: package\n" })).config.space).toBeUndefined();
    expect(() => loadConfig(makeTree({ ".context/context.yaml": "kind: package\nspace: Not Kebab\n" }))).toThrow();
  });

  test("a repo still on the old .claude/canon.yaml is told to move it, not silently given defaults", () => {
    const repo = makeTree({ ".claude/canon.yaml": "kind: web\n", "app.config.ts": "" });
    expect(() => loadConfig(repo)).toThrow(/move it to \.context\/context\.yaml/);
  });

  test("the local layer wins over the repo's context.yaml", () => {
    const repo = makeTree({
      ".context/context.yaml": "weigh:\n  weights:\n    C-07: 2\n    C-15: 3\n",
      ".context/context.local.yaml": "weigh:\n  weights:\n    C-07: 0.5\n",
      "app.config.ts": "",
    });
    const { config, sources } = loadConfig(repo);
    expect(config.weigh.weights).toEqual({ "C-07": 0.5, "C-15": 3 });
    expect(sources.map((s) => s.layer)).toEqual(["product", "local"]);
  });

  test("a context.yaml above the repo is never read: each repo carries its own rules", () => {
    const root = makeTree({ ".context/context.yaml": "packs: [react]\n", "app/.context/context.yaml": "packs: [expo]\n" });
    const { config, sources } = loadConfig(`${root}/app`);
    expect(config.packs).toEqual(["expo"]);
    expect(sources.map((s) => s.layer)).toEqual(["product"]);
  });

  test("a repo that draws its screens gets the design checks even when its modules list leaves them out", () => {
    const repo = makeTree({ ".context/context.yaml": "kind: web\nmodules: [docs, code]\n", ".context/designs/web/routes.js": "" });
    expect(loadConfig(repo).config.modules).toEqual(["docs", "code", "design"]);
  });

  test("copy sets come from the source repo's context.yaml", () => {
    const root = makeTree({
      "source/.context/context.yaml": "copies:\n  sets:\n    upload: [scripts/upload.mjs]\n",
      "app/.context/context.yaml": "copies:\n  source: ../source\n  use: [upload]\n",
    });
    expect(loadConfig(`${root}/app`).config.copies).toEqual({ source: `${root}/source`, sets: { upload: ["scripts/upload.mjs"] }, use: ["upload"] });
  });

  test("an unknown kind is a clear error naming the file", () => {
    const repo = makeTree({ ".context/context.yaml": "kind: desktop\n" });
    expect(() => loadConfig(repo)).toThrow(/context\.yaml.*kind/s);
  });

  test("standards resolve from the repo: a bare name is canon's, a path is the repo's own folder", () => {
    const repo = makeTree({ ".context/context.yaml": "standards: [docs/rules, design-sets]\n" });
    expect(loadConfig(repo).config.standards).toEqual([`${repo}/docs/rules`, "design-sets"]);
  });

  test("commands merge by id — the local layer replaces a command of the same id", () => {
    const repo = makeTree({
      ".context/context.yaml": "commands:\n  - { id: designs, run: a }\n  - { id: lint, run: b }\n",
      ".context/context.local.yaml": "commands:\n  - { id: designs, run: c, if: x }\n",
    });
    expect(loadConfig(repo).config.commands).toEqual([
      { id: "designs", run: "c", if: "x" },
      { id: "lint", run: "b" },
    ]);
  });

  test("the specs module is gone", () => {
    expect(() => loadConfig(makeTree({ ".context/context.yaml": "modules: [specs]\n" }))).toThrow(/modules/);
  });

  test("a wiki type or context folder needs a reason, and cannot redefine a built-in", () => {
    const load = (yaml: string) => () => loadConfig(makeTree({ ".context/context.yaml": yaml }));
    expect(load("wiki:\n  types:\n    - { type: bug, folder: bugs, sections: [Summary] }\n")).toThrow(/reason/);
    expect(load("wiki:\n  types:\n    - { type: bug, folder: bugs, reason: x }\n")).toThrow(/sections/);
    expect(load("wiki:\n  types:\n    - { type: bug, folder: bugs, reason: x, sections: [] }\n")).toThrow(/sections/);
    expect(load("context:\n  folders:\n    - { folder: research }\n")).toThrow(/reason/);
    expect(load("wiki:\n  types:\n    - { type: concept, folder: ideas, reason: x, sections: [Summary] }\n")).toThrow(/built-in/);
    expect(load("wiki:\n  types:\n    - { type: bug, folder: concepts, reason: x, sections: [Summary] }\n")).toThrow(/built-in/);
  });

  test("doctor tools merge by tool name", () => {
    const repo = makeTree({ ".context/context.yaml": "doctor:\n  tools:\n    - { tool: rtk, why: short output, hint: brew install rtk }\n" });
    expect(loadConfig(repo).config.doctor.tools).toEqual([{ tool: "rtk", why: "short output", hint: "brew install rtk" }]);
  });
});
