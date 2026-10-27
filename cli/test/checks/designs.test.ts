import { describe, expect, test } from "vitest";
import { designs, designSurfaces } from "../../src/checks/designs.ts";
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
