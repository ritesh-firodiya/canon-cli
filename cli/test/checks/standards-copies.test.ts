import { describe, expect, test } from "vitest";
import { standardsCopies } from "../../src/enforce/checks/standards-copies.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

describe("standards-copies", () => {
  const canon = makeTree({
    "standards/writing.md": "<!-- header -->\n\n# Writing\n\nRule one.\nRule two.\nRule three.\n",
    "plugins/canon-knowledge/skills/ask/SKILL.md": "---\nname: ask\n---\nAsk body.\n",
  });

  test("a wiki CLAUDE.md that copies the shared schema is a warning", () => {
    const repo = makeTree({ ".context/wiki/CLAUDE.md": "# Writing\n\nRule one.\nRule two.\nRule three.\n" });
    const findings = standardsCopies.run(contextFor(repo, { canonRoot: canon }));
    expect(findings).toEqual([expect.objectContaining({ file: ".context/wiki/CLAUDE.md", message: expect.stringMatching(/writing/) })]);
  });

  test("a short pointer file is fine", () => {
    const repo = makeTree({ ".context/wiki/CLAUDE.md": "Schema: see canon's writing standard.\n" });
    expect(standardsCopies.run(contextFor(repo, { canonRoot: canon }))).toEqual([]);
  });

  test("a product skill that canon now provides is a warning", () => {
    const repo = makeTree({ ".claude/skills/ask/SKILL.md": "anything" });
    const findings = standardsCopies.run(contextFor(repo, { canonRoot: canon }));
    expect(findings).toEqual([expect.objectContaining({ file: ".claude/skills/ask", message: expect.stringMatching(/canon-knowledge:ask/) })]);
  });
});
