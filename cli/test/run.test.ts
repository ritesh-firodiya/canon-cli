import { describe, expect, test } from "vitest";
import { findProducts, runChecks } from "../src/run.ts";
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
    const repo = makeTree({ ".claude/zeno.yaml": "modules: [docs]\n" });
    const report = runChecks(repo, { checks: [always, designOnly], zenoRoot: repo, estateRoot: repo });
    expect(report.findings.map((f) => f.check)).toEqual(["always"]);
    expect(report.skipped).toEqual([{ check: "design-only", why: "module design is off" }]);
  });

  test("a check turned off in zeno.yaml is skipped and listed as an override with its reason", () => {
    const repo = makeTree({ ".claude/zeno.yaml": "checks:\n  always:\n    enabled: false\n    reason: legacy\n" });
    const report = runChecks(repo, { checks: [always], zenoRoot: repo, estateRoot: repo });
    expect(report.findings).toEqual([]);
    expect(report.overrides).toEqual([{ check: "always", reason: "legacy" }]);
  });

  test("a check that throws becomes an error finding instead of crashing the run", () => {
    const repo = makeTree({ "README.md": "" });
    const report = runChecks(repo, { checks: [exploding, always], zenoRoot: repo, estateRoot: repo });
    expect(report.findings).toEqual([
      expect.objectContaining({ check: "exploding", level: "error", message: expect.stringMatching(/boom/) }),
      expect.objectContaining({ check: "always" }),
    ]);
  });

  test("a path that is not a folder is one clear error", () => {
    const report = runChecks("/no/such/repo", { checks: [always], zenoRoot: "/", estateRoot: "/" });
    expect(report.findings).toEqual([expect.objectContaining({ check: "repo", message: "no folder at /no/such/repo" })]);
  });

  test("an invalid zeno.yaml is reported as one error", () => {
    const repo = makeTree({ ".claude/zeno.yaml": "kind: desktop\n" });
    const report = runChecks(repo, { checks: [always], zenoRoot: repo, estateRoot: repo });
    expect(report.findings).toEqual([expect.objectContaining({ check: "config", level: "error" })]);
  });
});

describe("findProducts", () => {
  test("lists folders with a .context/ and skips everything else", () => {
    const estate = makeTree({ "a/.context/README.md": "", "b/README.md": "", "c/.context/tasks.md": "", "x.md": "" });
    expect(findProducts(estate).map((p) => p.split("/").pop())).toEqual(["a", "c"]);
  });
});
