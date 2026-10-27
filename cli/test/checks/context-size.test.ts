import { describe, expect, test } from "vitest";
import { contextSize } from "../../src/checks/context-size.ts";
import { makeTree, wikiPage } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const page = (lines: number) => wikiPage({ "last-verified": "2026-10-01" }, "x\n".repeat(lines));

function run(files: Record<string, string>) {
  return contextSize.run(contextFor(makeTree(files)));
}

describe("context-size", () => {
  test("short pages, a topic-named decision and an open-work tasks.md pass", () => {
    expect(
      run({
        ".context/README.md": "# Context\n",
        ".context/tasks.md": "# Tasks\n## Now\n1. [ ] T001 Ship\n",
        ".context/wiki/concepts/rounding.md": page(20),
        ".context/wiki/decisions/pricing.md": page(20),
      }),
    ).toEqual([]);
  });

  test("a page over its cap is a warning; decisions have a lower cap; synthesis is exempt", () => {
    const findings = run({
      ".context/wiki/concepts/long.md": page(70),
      ".context/wiki/decisions/pricing.md": page(40),
      ".context/wiki/synthesis/research.md": page(500),
    });
    expect(findings.map((f) => f.file).sort()).toEqual([".context/wiki/concepts/long.md", ".context/wiki/decisions/pricing.md"]);
    expect(findings.every((f) => f.level === "warn")).toBe(true);
  });

  test("a dated decision file name is flagged", () => {
    const findings = run({ ".context/wiki/decisions/2026-07-09-pricing.md": page(5) });
    expect(findings).toEqual([expect.objectContaining({ message: expect.stringMatching(/by topic/) })]);
  });

  test("flows/ is flagged once, not page by page; a short screen note passes, a long one is capped", () => {
    const findings = run({
      ".context/wiki/flows/a.md": page(100),
      ".context/wiki/flows/b.md": page(5),
      ".context/wiki/surfaces/home.md": page(10),
      ".context/wiki/surfaces/paywall.md": page(70),
    });
    expect(findings.map((f) => f.file).sort()).toEqual([".context/wiki/flows", ".context/wiki/surfaces/paywall.md"]);
  });

  test("tasks.md with Done or Session Notes is flagged, and so is a long README", () => {
    const findings = run({
      ".context/README.md": "x\n".repeat(31),
      ".context/tasks.md": "# Tasks\n## Now\n## Done\n- [x] T000\n",
    });
    expect(findings.map((f) => f.file).sort()).toEqual([".context/README.md", ".context/tasks.md"]);
  });
});
