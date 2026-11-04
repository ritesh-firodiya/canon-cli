import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { gate } from "../../src/enforce/checks/gate.ts";
import { oneHome } from "../../src/enforce/checks/one-home.ts";
import { contextFor } from "../helpers/context.ts";
import { makeTree } from "../helpers/fixture.ts";

const CANON = resolve(import.meta.dirname, "..", "..", "..");
const FACT = "Refunds are paid back to the original card within five working days of the request.";
const page = (body: string) => `---\nlast-verified: 2026-11-01\n---\n# Page\n\n${body}\n`;

function product() {
  return makeTree({
    ".context/context.yaml": "kind: package\nmodules: [docs]\n",
    ".context/README.md": "# Product\n",
    ".context/wiki/concepts/refunds.md": page(FACT),
    ".context/designs/big.html": "<html></html>",
  });
}

describe("one-home", () => {
  test("a fact written in two pages is reported on the second, and short phrases are not", () => {
    const repo = makeTree({ ".context/wiki/concepts/a.md": page(`${FACT} See the plan.`), ".context/wiki/concepts/b.md": page(`${FACT} See the plan.`) });
    const findings = oneHome.run(contextFor(repo));
    expect(findings).toEqual([expect.objectContaining({ file: ".context/wiki/concepts/b.md", message: expect.stringMatching(/repeats .*a\.md/) })]);
  });
});

describe("gate", () => {
  test("a page that repeats a fact, or has no frontmatter, is refused, and nothing is written", () => {
    const repo = product();
    const file = join(repo, ".context/wiki/concepts/copy.md");
    expect(gate(repo, file, page(FACT), CANON).map((f) => f.check)).toEqual(["one-home"]);
    expect(gate(repo, file, "# No frontmatter\n", CANON).map((f) => f.check)).toContain("wiki-frontmatter");
    expect(existsSync(file)).toBe(false);
  });

  test("a clean page passes, and an edit to an existing page is judged only for what it adds", () => {
    const repo = product();
    expect(gate(repo, join(repo, ".context/wiki/concepts/new.md"), page("A new fact nobody wrote before, long enough to count as one."), CANON)).toEqual([]);
    const existing = join(repo, ".context/wiki/concepts/refunds.md");
    expect(gate(repo, existing, page(`${FACT} One more line.`), CANON)).toEqual([]);
    expect(readFileSync(existing, "utf8")).toBe(page(FACT));
  });

  test("a file under a linked folder like designs is left to its own checks", () => {
    const repo = product();
    expect(gate(repo, join(repo, ".context/designs/big.html"), "x", CANON)).toEqual([]);
    expect(readFileSync(join(repo, ".context/designs/big.html"), "utf8")).toBe("<html></html>");
  });

  test("a change to the repo since the last write is seen, not hidden by the cache", () => {
    const repo = product();
    const file = join(repo, ".context/wiki/concepts/new.md");
    expect(gate(repo, file, page("Another fact that is long enough to count as one fact in this repo."), CANON)).toEqual([]);
    // The fact now lives in a page written outside the gate, so writing it again repeats it.
    writeFileSync(join(repo, ".context/wiki/concepts/other.md"), page("Another fact that is long enough to count as one fact in this repo."));
    expect(gate(repo, file, page("Another fact that is long enough to count as one fact in this repo."), CANON).map((f) => f.check)).toEqual(["one-home"]);
  });
});
