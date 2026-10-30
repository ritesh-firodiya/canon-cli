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

  test("in a Babul set a surface is each size folder with a journey", () => {
    const repo = makeTree({
      ".context/designs/babul.js": "",
      ".context/designs/mobile/index.html": "",
      ".context/designs/assets/icon.svg": "",
    });
    expect(designSurfaces(repo)).toEqual([".context/designs/mobile"]);
  });

  test("runs canon's checker once per surface; a failing surface is one error carrying its output", () => {
    const repo = makeTree({ ".context/designs/mobile/routes.js": "", ".context/designs/web/routes.js": "" });
    const findings = designs.run({ ...contextFor(repo), canonRoot: makeTree(CANON) });
    expect(findings).toEqual([{ check: "designs", level: "error", file: ".context/designs/web", message: "FAIL screen.html: no routes entry" }]);
  });

  describe("the set's link to canon's shell", () => {
    const LOADER = 'var SHELL = "https://cdn.jsdelivr.net/npm/@freetesh/canon@{version}/shell/";\n';
    const canon = (version: string) => makeTree({ ...CANON, "package.json": JSON.stringify({ version }), "shell/loader.js": LOADER });
    const set = (files: Record<string, string>) => makeTree({ ".context/designs/babul.js": "", ...files });
    const loader = (version: string) => ({ ".context/designs/shell.js": LOADER.replace("{version}", version) });

    test("a set pinned to this canon, with no copy of the shell, passes", () => {
      expect(designs.run({ ...contextFor(set(loader("1.2.0"))), canonRoot: canon("1.2.0") })).toEqual([]);
    });

    test("a copied _shell, a missing loader or a hand-written one is an error", () => {
      const run = (files: Record<string, string>) => designs.run({ ...contextFor(set(files)), canonRoot: canon("1.2.0") }).map((f) => f.message);
      expect(run({ ...loader("1.2.0"), ".context/designs/_shell/boot.js": "" })).toEqual(["the shell lives in canon — delete this copy"]);
      expect(run({})).toEqual(["missing — `canon ui` writes it"]);
      expect(run({ ".context/designs/shell.js": "document.write('x')" })).toEqual(["is not canon's loader — delete it and run `canon ui`"]);
    });

    test("a set pinned to another canon is a warning naming both versions", () => {
      expect(designs.run({ ...contextFor(set(loader("1.1.0"))), canonRoot: canon("1.2.0") })).toEqual([
        expect.objectContaining({ level: "warn", message: "pins canon 1.1.0; this canon is 1.2.0 — change the version in it" }),
      ]);
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
