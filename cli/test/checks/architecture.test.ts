import { copyFileSync, mkdirSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { architecture, architectureGraph, summarize } from "../../src/checks/architecture.ts";
import { architectureStarters } from "../../src/init/init.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
// dependency-cruiser is canon's own devDependency.
const PACKAGE = ROOT;
const ON = { ".context/context.yaml": "modules: [architecture]\n" };

/** A repo laid out with the starters `canon init` writes, with canon's own dependency-cruiser linked in as if it were a devDependency. */
function repoWith(files: Record<string, string>): string {
  const repo = makeTree({ ...ON, ...files });
  for (const { file, template } of architectureStarters(repo)) {
    copyFileSync(join(ROOT, "templates", "dependency-cruiser", template), join(repo, file));
  }
  mkdirSync(join(repo, "node_modules", ".bin"), { recursive: true });
  symlinkSync(join(PACKAGE, "node_modules", "dependency-cruiser"), join(repo, "node_modules", "dependency-cruiser"));
  symlinkSync(join(PACKAGE, "node_modules", ".bin", "depcruise"), join(repo, "node_modules", ".bin", "depcruise"));
  return repo;
}

// Workspaces are folders under apps/ and packages/ with a package.json.
const CLEAN = {
  "apps/web/package.json": "{}",
  "packages/ui/package.json": "{}",
  "apps/web/src/main.js": 'import { greet } from "../../../packages/ui/src/greet.js";\ngreet();\n',
  "packages/ui/src/greet.js": "export const greet = () => 1;\n",
};

describe("summarize", () => {
  test("groups violations by rule, shows the first few and counts the rest", () => {
    const violations = ["a", "b", "c", "d", "e"].map((name) => ({ rule: { name: "no-orphans", severity: "warn" }, from: `src/${name}.ts`, to: `src/${name}.ts` }));
    const findings = summarize([...violations, { rule: { name: "no-circular", severity: "error" }, from: "x.ts", to: "y.ts" }]);
    expect(findings).toEqual([
      { check: "architecture", level: "warn", file: "src/a.ts", message: "no-orphans (5): src/a.ts, src/b.ts, src/c.ts and 2 more" },
      { check: "architecture", level: "error", file: "x.ts", message: "no-circular (1): x.ts → y.ts" },
    ]);
  });

  test("info-level violations are not findings", () => {
    expect(summarize([{ rule: { name: "x", severity: "info" }, from: "a", to: "b" }])).toEqual([]);
  });
});

describe("architecture check", () => {
  test("a repo that keeps its boundaries passes", () => {
    expect(architecture.run(contextFor(repoWith(CLEAN)))).toEqual([]);
  });

  test("an app importing another app, and a package importing an app, are errors", () => {
    const repo = repoWith({
      ...CLEAN,
      "apps/admin/package.json": "{}",
      "apps/admin/src/main.js": 'import "../../web/src/main.js";\n',
      "packages/ui/src/bad.js": 'import "../../../apps/web/src/main.js";\nexport const bad = 1;\n',
    });
    const findings = architecture.run(contextFor(repo));
    expect(findings).toContainEqual(expect.objectContaining({ level: "error", message: "no-app-to-app (1): apps/admin/src/main.js → apps/web/src/main.js" }));
    expect(findings).toContainEqual(expect.objectContaining({ level: "error", message: expect.stringMatching(/^no-package-to-app \(1\): packages\/ui\/src\/bad\.js/) }));
  });

  test("npm packages are seen: importing one package.json does not declare is caught", () => {
    const repo = repoWith({
      ...CLEAN,
      "package.json": JSON.stringify({ name: "app" }),
      "node_modules/undeclared/package.json": JSON.stringify({ name: "undeclared", main: "dist/index.js" }),
      "node_modules/undeclared/dist/index.js": "module.exports = 1;\n",
      "apps/web/src/main.js": 'import "undeclared";\nimport { greet } from "../../../packages/ui/src/greet.js";\ngreet();\n',
    });
    expect(architecture.run(contextFor(repo))).toContainEqual(
      expect.objectContaining({ message: expect.stringMatching(/^no-non-package-json \(1\): apps\/web\/src\/main\.js → node_modules\/undeclared/) }),
    );
  });

  // canon's own devDependency is TypeScript 7, which dependency-cruiser cannot use yet,
  // so this fixture reproduces a repo whose TypeScript would silently go unchecked.
  test("a TypeScript workspace whose .ts files could not be read is a warning, not a pass", () => {
    const repo = repoWith({ "tsconfig.json": "{}", "src/a.ts": 'import { b } from "./b";\nexport const a = b;\n', "src/b.ts": "export const b = 1;\n" });
    expect(architecture.run(contextFor(repo))).toContainEqual(
      expect.objectContaining({ level: "warn", message: expect.stringMatching(/no TypeScript files were read/) }),
    );
  });

  test("with the module on but no rules file, the repo is told how to start", () => {
    expect(architecture.run(contextFor(makeTree({ ...ON, "src/a.js": "" })))).toEqual([
      expect.objectContaining({ level: "error", file: ".dependency-cruiser.cjs", message: expect.stringMatching(/canon init --force --modules/) }),
    ]);
  });

  test("with rules but no dependency-cruiser installed, the repo is told to add it", () => {
    const repo = makeTree({ ...ON, ".dependency-cruiser.cjs": "module.exports = {};" });
    expect(architecture.run(contextFor(repo))).toEqual([
      expect.objectContaining({ level: "error", message: expect.stringMatching(/add -D dependency-cruiser/) }),
    ]);
  });
});

describe("workspaces", () => {

  test("each workspace with its own rules is checked from its folder, findings keep the repo path", () => {
    const repo = makeTree({
      ...ON,
      "apps/web/src/main.js": "export const x = 1;\n",
      "apps/admin/src/main.js": 'import "../../web/src/main.js";\n',
      "apps/admin/.dependency-cruiser.cjs":
        'module.exports = { forbidden: [{ name: "no-app-to-app", severity: "error", from: {}, to: { path: "^\\\\.\\\\./[^./]" } }] };',
    });
    mkdirSync(join(repo, "node_modules", ".bin"), { recursive: true });
    symlinkSync(join(PACKAGE, "node_modules", "dependency-cruiser"), join(repo, "node_modules", "dependency-cruiser"));
    symlinkSync(join(PACKAGE, "node_modules", ".bin", "depcruise"), join(repo, "node_modules", ".bin", "depcruise"));
    expect(architecture.run(contextFor(repo))).toEqual([
      expect.objectContaining({ level: "error", file: "apps/admin/src/main.js", message: "no-app-to-app (1): apps/admin/src/main.js → apps/web/src/main.js" }),
    ]);
  });
});

describe("architectureGraph", () => {
  test("draws one mermaid graph per workspace", () => {
    const graph = architectureGraph(repoWith(CLEAN));
    expect(graph).toMatch(/^## apps\/web\n\n```mermaid\nflowchart LR/);
    expect(graph).toContain("## packages/ui");
  });

  test("draws the repo's own parts only, not the npm packages they import", () => {
    const repo = repoWith({
      ...CLEAN,
      "apps/web/package.json": JSON.stringify({ dependencies: { "some-lib": "1.0.0" } }),
      "node_modules/some-lib/package.json": JSON.stringify({ name: "some-lib", main: "dist/index.js" }),
      "node_modules/some-lib/dist/index.js": "module.exports = 1;\n",
      "apps/web/src/main.js": 'import "some-lib";\nimport { greet } from "../../../packages/ui/src/greet.js";\ngreet();\n',
    });
    const graph = architectureGraph(repo) ?? "";
    expect(graph).toContain("## apps/web");
    expect(graph).not.toContain("some-lib");
    expect(graph).not.toContain("node_modules");
  });

  test("is undefined for a repo without rules or without dependency-cruiser", () => {
    expect(architectureGraph(makeTree({}))).toBeUndefined();
    expect(architectureGraph(makeTree({ ".dependency-cruiser.cjs": "module.exports = {};" }))).toBeUndefined();
  });
});
