import { describe, expect, test } from "vitest";
import { designs, designsFirst, designSurfaces, failureReport } from "../../src/enforce/checks/designs.ts";
import { loadConfig } from "../../src/config/load.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const CANON = {};

describe("designs", () => {
  test("a set that is not a Babul set has no surface", () => {
    expect(designSurfaces(makeTree({ ".context/designs/mobile/index.html": "" }))).toEqual([]);
  });

  test("in a Babul set a surface is each size folder with a journey", () => {
    const repo = makeTree({
      ".context/designs/design.js": "",
      ".context/designs/mobile/index.html": "",
      ".context/designs/assets/icon.svg": "",
    });
    expect(designSurfaces(repo)).toEqual([".context/designs/mobile"]);
  });

  describe("the set holds none of canon's shell", () => {
    const run = (files: Record<string, string>) =>
      designs.run({ ...contextFor(makeTree({ ".context/designs/design.js": "", ...files })), canonRoot: makeTree(CANON) }).map((f) => `${f.file}: ${f.message}`);

    test("a set with no shell.js and no _shell passes", () => {
      expect(run({})).toEqual([]);
    });

    test("a shell.js pinned to a published version is an error: a pin stops at that major for good", () => {
      expect(run({ ".context/designs/shell.js": 'var SHELL = "https://unpkg.com/@freetesh/canon@0/shell/";' })).toEqual([
        '.context/designs/shell.js: points at a pinned canon — use https://unpkg.com/@freetesh/canon/shell/',
      ]);
      expect(run({ ".context/designs/shell.js": 'var SHELL = "https://unpkg.com/@freetesh/canon/shell/";' })).toEqual([]);
    });

    test("a copied _shell is an error; the set's one shell.js loader is not", () => {
      expect(run({ ".context/designs/shell.js": "", ".context/designs/_shell/boot.js": "" })).toEqual([
        ".context/designs/_shell: the shell lives in canon — delete this copy",
      ]);
    });
  });

  describe("a failing surface's report", () => {
    const passes = (n: number) => Array.from({ length: n }, (_, i) => `== check ${i}\n   ok`).join("\n");

    test("keeps every FAIL line, however long the report, and its count", () => {
      const output = ["== tokens", "   FAIL console/a.html uses ring-faint — declared nowhere", passes(20), "2 FAILURES"].join("\n");
      expect(failureReport(output)).toBe("   FAIL console/a.html uses ring-faint — declared nowhere\n2 FAILURES");
    });

    test("caps a long list of FAIL lines and says how many more there are", () => {
      const output = [...Array.from({ length: 20 }, (_, i) => `   FAIL page${i}.html`), "20 FAILURES"].join("\n");
      const lines = failureReport(output).split("\n");
      expect(lines).toHaveLength(17);
      expect(lines.at(-2)).toBe("   … and 5 more");
      expect(lines.at(-1)).toBe("20 FAILURES");
    });

    test("with no FAIL line to show, falls back to the end of the report", () => {
      expect(failureReport([passes(20), "1 FAILURES"].join("\n")).split("\n").at(-1)).toBe("1 FAILURES");
    });
  });

  test("a repo with no drawn surface has nothing to check", () => {
    expect(designs.run({ ...contextFor(makeTree({ "README.md": "" })), canonRoot: makeTree(CANON) })).toEqual([]);
  });
});

describe("designs-first", () => {
  const run = (files: Record<string, string>) => {
    const repo = makeTree(files);
    return designsFirst.run(contextFor(repo, { config: loadConfig(repo).config }));
  };

  const onDesignSets = (yaml = "") => ({ ".context/context.yaml": `${yaml}standards: [design-sets]\n` });

  test("a mobile or web repo on design-sets with no .context/designs is an error", () => {
    expect(run({ ...onDesignSets(), "app.config.ts": "" })).toEqual([expect.objectContaining({ check: "designs-first", level: "error" })]);
    expect(run(onDesignSets("kind: mobile-and-web\n"))).toHaveLength(1);
  });

  test("passes once the designs exist, and never applies to a package or content repo", () => {
    expect(run({ ...onDesignSets(), "next.config.ts": "", ".context/designs/web/routes.js": "" })).toEqual([]);
    expect(run(onDesignSets("kind: package\n"))).toEqual([]);
    expect(run({ ...onDesignSets(), "README.md": "" })).toEqual([]);
  });

  test("a repo that does not import design-sets designs elsewhere and is not asked for .context/designs", () => {
    expect(run({ "app.config.ts": "" })).toEqual([]);
    expect(run({ ".context/context.yaml": "kind: mobile-and-web\nstandards: [pipeline]\n" })).toEqual([]);
  });
});
