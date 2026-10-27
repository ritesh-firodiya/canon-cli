import { describe, expect, test } from "vitest";
import { wikiFrontmatter } from "../../src/checks/wiki-frontmatter.ts";
import { makeTree, wikiPage } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const TODAY = new Date("2026-10-23");
const good = { id: "CONCEPT.UPLOAD-ONLY", type: "concept", status: "canonical", "last-verified": "2026-10-01" };

function run(files: Record<string, string>) {
  return wikiFrontmatter.run(contextFor(makeTree(files), { today: TODAY }));
}

describe("wiki-frontmatter", () => {
  test("a well-formed page passes", () => {
    expect(run({ ".context/wiki/concepts/upload-only.md": wikiPage(good) })).toEqual([]);
  });

  test("index.md and CLAUDE.md are not pages", () => {
    expect(run({ ".context/wiki/index.md": "# Index", ".context/wiki/CLAUDE.md": "# Schema" })).toEqual([]);
  });

  test("a page with no frontmatter is an error", () => {
    const findings = run({ ".context/wiki/concepts/upload-only.md": "# Upload only\n" });
    expect(findings).toEqual([expect.objectContaining({ level: "error", message: expect.stringMatching(/frontmatter/) })]);
  });

  test("last-verified is the only required field", () => {
    expect(run({ ".context/wiki/concepts/upload-only.md": wikiPage({ "last-verified": "2026-10-01" }) })).toEqual([]);
    const findings = run({ ".context/wiki/concepts/upload-only.md": wikiPage({ type: "concept" }) });
    expect(findings[0].message).toMatch(/last-verified/);
  });

  test("an untyped page outside a wiki folder is an error", () => {
    const findings = run({ ".context/wiki/notes/home.md": wikiPage({ "last-verified": "2026-10-01" }) });
    expect(findings[0].message).toMatch(/notes\/ is not a wiki folder/);
  });

  test("placeholder text is a warning, but not inside a code block", () => {
    const page = (body: string) => wikiPage(good, body);
    const findings = run({ ".context/wiki/concepts/upload-only.md": page("## Copy\n_(none yet)_\n") });
    expect(findings).toEqual([expect.objectContaining({ level: "warn", message: expect.stringMatching(/placeholder "none yet"/) })]);
    expect(run({ ".context/wiki/concepts/upload-only.md": page("```\nTODO: TBD\n```\n") })).toEqual([]);
  });

  test("type must match its folder", () => {
    const findings = run({ ".context/wiki/entities/upload-only.md": wikiPage(good) });
    expect(findings[0].message).toMatch(/concept.*entities/);
  });

  test("a type added under wiki.types lives in its configured folder", () => {
    const yaml = "wiki:\n  types:\n    - { type: bug, folder: bugs, reason: postmortems, sections: [Summary] }\n";
    const bug = wikiPage({ ...good, id: "BUG.LOST-STREAK", type: "bug" });
    expect(run({ ".claude/zeno.yaml": yaml, ".context/wiki/bugs/lost-streak.md": bug })).toEqual([]);
    expect(run({ ".claude/zeno.yaml": yaml, ".context/wiki/concepts/lost-streak.md": bug })[0].message).toMatch(/bug.*concepts/);
  });

  test("a page of an added type needs every section its config lists", () => {
    const yaml = "wiki:\n  types:\n    - { type: postmortem, folder: postmortems, reason: incidents, sections: [Summary, Timeline, Fix] }\n";
    const page = (body: string) => wikiPage({ ...good, id: "POSTMORTEM.RESET", type: "postmortem" }, body);
    expect(run({ ".claude/zeno.yaml": yaml, ".context/wiki/postmortems/reset.md": page("## Summary\nx\n## Timeline\nx\n## Fix\nx\n") })).toEqual([]);
    const findings = run({ ".claude/zeno.yaml": yaml, ".context/wiki/postmortems/reset.md": page("## Summary\nx\n## Fixes\nx\n") });
    expect(findings).toEqual([expect.objectContaining({ level: "error", message: "missing sections: Timeline, Fix" })]);
  });

  test("stale pages are one warning per product: count, then the oldest first", () => {
    const stale = (date: string, id: string) => wikiPage({ ...good, id, "last-verified": date });
    const findings = run({
      ".context/wiki/concepts/a.md": stale("2026-06-01", "CONCEPT.A"),
      ".context/wiki/concepts/b.md": stale("2026-05-01", "CONCEPT.B"),
      ".context/wiki/concepts/c.md": wikiPage({ ...good, id: "CONCEPT.C" }),
    });
    expect(findings).toEqual([
      expect.objectContaining({
        level: "warn",
        file: ".context/wiki",
        message: "2 pages last verified over 90 days ago — oldest: concepts/b.md (175d), concepts/a.md (144d)",
      }),
    ]);
  });

  test("two pages with the same id is an error", () => {
    const findings = run({
      ".context/wiki/concepts/upload-only.md": wikiPage(good),
      ".context/wiki/concepts/upload-only-2.md": wikiPage(good),
    });
    expect(findings.some((f) => /duplicate id/.test(f.message))).toBe(true);
  });

  test("a product with no wiki has nothing to check", () => {
    expect(run({ "README.md": "" })).toEqual([]);
  });
});
