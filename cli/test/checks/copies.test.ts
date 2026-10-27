import { describe, expect, test } from "vitest";
import { staleCopies, standardsCopies } from "../../src/checks/copies.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

describe("stale-copies", () => {
  test("agent instruction files for tools not in use are warnings", () => {
    const repo = makeTree({ ".github/copilot-instructions.md": "x", ".cursorrules": "x", "AGENTS.md": "x" });
    const files = staleCopies.run(contextFor(repo)).map((f) => f.file);
    expect(files).toEqual([".github/copilot-instructions.md", ".cursorrules"]);
  });
});

describe("standards-copies", () => {
  const canon = makeTree({
    "standards/wiki-schema.md": "<!-- header -->\n\n# Wiki schema\n\nRule one.\nRule two.\nRule three.\n",
    "skills/ask/SKILL.md": "---\nname: ask\n---\nAsk body.\n",
  });

  test("a wiki CLAUDE.md that copies the shared schema is a warning", () => {
    const repo = makeTree({ ".context/wiki/CLAUDE.md": "# Wiki schema\n\nRule one.\nRule two.\nRule three.\n" });
    const findings = standardsCopies.run(contextFor(repo, { canonRoot: canon }));
    expect(findings).toEqual([expect.objectContaining({ file: ".context/wiki/CLAUDE.md", message: expect.stringMatching(/wiki-schema/) })]);
  });

  test("a short pointer file is fine", () => {
    const repo = makeTree({ ".context/wiki/CLAUDE.md": "Schema: see the canon plugin's wiki-schema.\n" });
    expect(standardsCopies.run(contextFor(repo, { canonRoot: canon }))).toEqual([]);
  });

  test("a product skill that canon now provides is a warning", () => {
    const repo = makeTree({ ".claude/skills/ask/SKILL.md": "anything" });
    const findings = standardsCopies.run(contextFor(repo, { canonRoot: canon }));
    expect(findings).toEqual([expect.objectContaining({ file: ".claude/skills/ask", message: expect.stringMatching(/canon:ask/) })]);
  });
});
