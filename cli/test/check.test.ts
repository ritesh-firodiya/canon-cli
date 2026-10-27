import { describe, expect, test } from "vitest";
import { findProducts, findWorkspace, runChecks } from "../src/check.ts";
import type { Check } from "../src/checks/types.ts";
import { makeTree } from "./helpers/fixture.ts";

const always: Check = {
  id: "always",
  module: null,
  description: "",
  run: () => [{ check: "always", level: "warn", message: "w" }],
};
const designOnly: Check = {
  id: "design-only",
  module: "design",
  description: "",
  run: () => [{ check: "design-only", level: "error", message: "e" }],
};
const exploding: Check = {
  id: "exploding",
  module: null,
  description: "",
  run: () => {
    throw new Error("boom");
  },
};

describe("runChecks", () => {
  test("runs checks whose module is enabled and skips the rest", () => {
    const repo = makeTree({ ".claude/canon.yaml": "modules: [docs]\n" });
    const report = runChecks(repo, { checks: [always, designOnly], canonRoot: repo });
    expect(report.findings.map((f) => f.check)).toEqual(["always"]);
    expect(report.skipped).toEqual([{ check: "design-only", why: "module design is off" }]);
  });


  test("a check that throws becomes an error finding instead of crashing the run", () => {
    const repo = makeTree({ "README.md": "" });
    const report = runChecks(repo, { checks: [exploding, always], canonRoot: repo });
    expect(report.findings).toEqual([
      expect.objectContaining({ check: "exploding", level: "error", message: expect.stringMatching(/boom/) }),
      expect.objectContaining({ check: "always" }),
    ]);
  });

  test("a path that is not a folder is one clear error", () => {
    const report = runChecks("/no/such/repo", { checks: [always], canonRoot: "/" });
    expect(report.findings).toEqual([expect.objectContaining({ check: "repo", message: "no folder at /no/such/repo" })]);
  });

  test("an invalid canon.yaml is reported as one error", () => {
    const repo = makeTree({ ".claude/canon.yaml": "kind: desktop\n" });
    const report = runChecks(repo, { checks: [always], canonRoot: repo });
    expect(report.findings).toEqual([expect.objectContaining({ check: "config", level: "error" })]);
  });
});

describe("findProducts", () => {
  test("lists folders with a .context/ and skips everything else", () => {
    const workspace = makeTree({ "a/.context/README.md": "", "b/README.md": "", "c/.context/tasks.md": "", "x.md": "" });
    expect(findProducts(workspace).map((p) => p.split("/").pop())).toEqual(["a", "c"]);
  });
});

describe("findWorkspace", () => {
  const workspace = () => makeTree({ "a/.git/HEAD": "", "a/.context/README.md": "", "a/src/deep/x.ts": "", "b/.context/README.md": "" });

  test("from inside a repo, is the folder holding that repo", () => {
    const root = workspace();
    expect(findWorkspace(`${root}/a/src/deep`)).toBe(root);
  });

  test("outside any repo, is the folder itself when it holds products", () => {
    const root = workspace();
    expect(findWorkspace(root)).toBe(root);
  });

  test("is null when the folder holds no product", () => {
    expect(findWorkspace(makeTree({ "notes.md": "" }))).toBeNull();
  });
});
