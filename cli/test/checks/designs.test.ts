import { describe, expect, test } from "vitest";
import { designs, designsFirst, designSurfaces } from "../../src/checks/designs.ts";
import { loadConfig } from "../../src/config/load.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

// A stand-in checker: fails the surface whose path names "web", passes the rest.
const CANON = { "scripts/check-designs.py": "import sys\nif 'web' in sys.argv[1]:\n    print('   FAIL screen.html: no routes entry'); sys.exit(1)\n" };

describe("designs", () => {
  test("a surface is a folder under .context/designs with a routes.js", () => {
    const repo = makeTree({ ".context/designs/mobile/routes.js": "", ".context/designs/brand/icon.svg": "", ".context/designs/web/routes.js": "" });
    expect(designSurfaces(repo)).toEqual([".context/designs/mobile", ".context/designs/web"]);
  });

  test("runs canon's checker once per surface; a failing surface is one error carrying its output", () => {
    const repo = makeTree({ ".context/designs/mobile/routes.js": "", ".context/designs/web/routes.js": "" });
    const findings = designs.run({ ...contextFor(repo), canonRoot: makeTree(CANON) });
    expect(findings).toEqual([{ check: "designs", level: "error", file: ".context/designs/web", message: "FAIL screen.html: no routes entry" }]);
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

  const onDesignSets = (yaml = "") => ({ ".claude/canon.yaml": `${yaml}standards: [design-sets]\n` });

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
    expect(run({ ".claude/canon.yaml": "kind: mobile-and-web\nstandards: [pipeline]\n" })).toEqual([]);
  });
});
