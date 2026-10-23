import { describe, expect, test } from "vitest";
import { contextLayout } from "../../src/checks/context-layout.ts";
import { makeTree, VALID_CONTEXT } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

describe("context-layout", () => {
  test("a complete .context passes", () => {
    expect(contextLayout.run(contextFor(makeTree(VALID_CONTEXT)))).toEqual([]);
  });

  test("a missing required folder is an error", () => {
    const { ".context/features/index.md": _, ...rest } = VALID_CONTEXT;
    const findings = contextLayout.run(contextFor(makeTree(rest)));
    expect(findings).toEqual([expect.objectContaining({ level: "error", file: ".context/features" })]);
  });

  test("designs/ is required only when the design module is on", () => {
    const { ".context/designs/mobile/routes.js": _, ...noDesigns } = VALID_CONTEXT;
    expect(contextLayout.run(contextFor(makeTree({ ...noDesigns, ".claude/zeno.yaml": "modules: [docs]\n" })))).toEqual([]);
    const findings = contextLayout.run(contextFor(makeTree({ ...noDesigns, ".claude/zeno.yaml": "modules: [docs, design]\n" })));
    expect(findings).toEqual([expect.objectContaining({ file: ".context/designs", message: expect.stringMatching(/stage 1/) })]);
  });

  test("a file at .context root other than README.md and tasks.md is an error", () => {
    const findings = contextLayout.run(contextFor(makeTree({ ...VALID_CONTEXT, ".context/TODO.md": "x" })));
    expect(findings).toEqual([expect.objectContaining({ level: "error", file: ".context/TODO.md" })]);
  });

  test("a folder outside the ten is an error", () => {
    const findings = contextLayout.run(contextFor(makeTree({ ...VALID_CONTEXT, ".context/documents/a.md": "x" })));
    expect(findings).toEqual([expect.objectContaining({ file: ".context/documents" })]);
  });

  test("a repo with no .context at all gets one error, not one per folder", () => {
    const findings = contextLayout.run(contextFor(makeTree({ "README.md": "" })));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/no \.context/);
  });

  test("raw/ without its .gitkeep is a warning", () => {
    const { ".context/raw/.gitkeep": _, ...rest } = VALID_CONTEXT;
    const findings = contextLayout.run(contextFor(makeTree({ ...rest, ".context/raw/": "" })));
    expect(findings).toEqual([expect.objectContaining({ level: "warn", file: ".context/raw/.gitkeep" })]);
  });
});
