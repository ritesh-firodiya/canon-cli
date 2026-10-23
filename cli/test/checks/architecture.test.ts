import { copyFileSync, mkdirSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { architecture, architectureGraph, summarize } from "../../src/checks/architecture.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const ZENO = resolve(import.meta.dirname, "..", "..", "..");
const ON = { ".claude/zeno.yaml": "modules: [architecture]\n" };

/** A repo using the starter rules, with zeno's own dependency-cruiser linked in as if it were a devDependency. */
function repoWith(files: Record<string, string>): string {
  const repo = makeTree({ ...ON, ...files });
  copyFileSync(join(ZENO, "templates", "dependency-cruiser.cjs"), join(repo, ".dependency-cruiser.cjs"));
  mkdirSync(join(repo, "node_modules", ".bin"), { recursive: true });
  symlinkSync(join(ZENO, "node_modules", "dependency-cruiser"), join(repo, "node_modules", "dependency-cruiser"));
  symlinkSync(join(ZENO, "node_modules", ".bin", "depcruise"), join(repo, "node_modules", ".bin", "depcruise"));
  return repo;
}

const CLEAN = {
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
      "apps/admin/src/main.js": 'import "../../web/src/main.js";\n',
      "packages/ui/src/bad.js": 'import "../../../apps/web/src/main.js";\nexport const bad = 1;\n',
    });
    const findings = architecture.run(contextFor(repo));
    expect(findings).toContainEqual(expect.objectContaining({ level: "error", message: "no-app-to-app (1): apps/admin/src/main.js → apps/web/src/main.js" }));
    expect(findings).toContainEqual(expect.objectContaining({ level: "error", message: expect.stringMatching(/^no-package-to-app \(1\): packages\/ui\/src\/bad\.js/) }));
  });

  test("with the module on but no rules file, the repo is told how to start", () => {
    expect(architecture.run(contextFor(makeTree({ ...ON, "src/a.js": "" })))).toEqual([
      expect.objectContaining({ level: "error", file: ".dependency-cruiser.cjs", message: expect.stringMatching(/zeno init --force --modules/) }),
    ]);
  });

  test("with rules but no dependency-cruiser installed, the repo is told to add it", () => {
    const repo = makeTree({ ...ON, ".dependency-cruiser.cjs": "module.exports = {};" });
    expect(architecture.run(contextFor(repo))).toEqual([
      expect.objectContaining({ level: "error", message: expect.stringMatching(/add -D dependency-cruiser/) }),
    ]);
  });
});

describe("architectureGraph", () => {
  test("draws one box per collapsed folder, as mermaid", () => {
    const graph = architectureGraph(repoWith(CLEAN));
    expect(graph).toMatch(/^flowchart LR/);
    expect(graph).toContain('["web"]');
    expect(graph).toContain('["ui"]');
  });

  test("is undefined for a repo without rules or without dependency-cruiser", () => {
    expect(architectureGraph(makeTree({}))).toBeUndefined();
    expect(architectureGraph(makeTree({ ".dependency-cruiser.cjs": "module.exports = {};" }))).toBeUndefined();
  });
});
