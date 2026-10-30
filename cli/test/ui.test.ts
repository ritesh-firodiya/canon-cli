import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { fileFor, findDesigns } from "../src/ui/ui.command.ts";
import { servedLoader } from "../src/ui/shell.ts";
import { makeTree } from "./helpers/fixture.ts";

describe("canon ui", () => {
  test("finds the design set from anywhere inside the repo", () => {
    const repo = makeTree({ ".context/designs/babul.js": "", "src/app/page.tsx": "" });
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

  test("points the set's loader at the served shell", () => {
    expect(servedLoader('a\n  var SHELL = "https://cdn/x/";\nb', "/_shell/")).toBe('a\n  var SHELL = "/_shell/";\nb');
  });
});
