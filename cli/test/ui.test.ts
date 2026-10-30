import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { fileFor, findDesigns } from "../src/ui/ui.command.ts";
import { loaderAt } from "../src/ui/shell.ts";
import { makeTree } from "./helpers/fixture.ts";

describe("canon ui", () => {
  test("finds the design set from anywhere inside the repo", () => {
    const repo = makeTree({ ".context/designs/design.js": "", "src/app/page.tsx": "" });
    expect(findDesigns(join(repo, "src/app"))).toBe(join(repo, ".context/designs"));
    expect(findDesigns(makeTree({ "README.md": "" }))).toBeNull();
  });

  test("serves canon's shell under /_shell/, the set elsewhere, and nothing outside either", () => {
    const repo = makeTree({ "designs/mobile/index.html": "", "shell/boot.js": "" });
    const [designs, shell] = [join(repo, "designs"), join(repo, "shell")];
    expect(fileFor(designs, shell, "/_shell/boot.js")).toBe(join(shell, "boot.js"));
    expect(fileFor(designs, shell, "/mobile/home.html?state=empty")).toBe(join(designs, "mobile/home.html"));
    expect(fileFor(designs, shell, "/mobile/")).toBe(join(designs, "mobile/index.html"));
    expect(fileFor(designs, shell, "/../secret")).toBeNull();
    expect(fileFor(designs, shell, "/_shell/../../secret")).toBeNull();
  });

  test("serves the architecture view from the shell, for any size", () => {
    const repo = makeTree({ "designs/mobile/index.html": "", "shell/architecture.html": "" });
    const [designs, shell] = [join(repo, "designs"), join(repo, "shell")];
    expect(fileFor(designs, shell, "/web/architecture.html")).toBe(join(shell, "architecture.html"));
    expect(fileFor(designs, shell, "/web/doc/architecture.html")).toBe(join(designs, "web/doc/architecture.html"));
  });

  test("the loader a page gets points at the served shell, with no version in it", () => {
    const loader = loaderAt(resolve(import.meta.dirname, "../.."), "/_shell/");
    expect(loader).toContain('var SHELL = "/_shell/";');
    expect(loader).not.toMatch(/\{shell\}|@freetesh|jsdelivr/);
  });
});
