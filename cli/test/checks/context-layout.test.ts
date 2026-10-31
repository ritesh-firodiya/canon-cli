import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { contextLayout } from "../../src/checks/context-layout.ts";
import { makeTree, VALID_CONTEXT } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const at = (files: Record<string, string>) => contextFor(makeTree(files), { today: new Date("2026-10-23") });

describe("context-layout", () => {
  test("a complete .context passes", () => {
    expect(contextLayout.run(contextFor(makeTree(VALID_CONTEXT)))).toEqual([]);
  });

  test("a missing required folder is an error", () => {
    const { ".context/features/index.md": _, ...rest } = VALID_CONTEXT;
    const findings = contextLayout.run(contextFor(makeTree(rest)));
    expect(findings).toEqual([expect.objectContaining({ level: "error", file: ".context/features" })]);
  });

  test("designs/ is never required, even with the design module on", () => {
    const { ".context/designs/mobile/routes.js": _, ...noDesigns } = VALID_CONTEXT;
    expect(contextLayout.run(contextFor(makeTree({ ...noDesigns, ".context/context.yaml": "modules: [docs, design]\n" })))).toEqual([]);
  });

  test("without docs or knowledge only README.md and tasks.md are required", () => {
    const tree = makeTree({ ".context/README.md": "# c\n", ".context/tasks.md": "# T\n", ".context/context.yaml": "modules: [code]\n" });
    expect(contextLayout.run(contextFor(tree))).toEqual([]);
    const findings = contextLayout.run(contextFor(makeTree({ ".context/README.md": "# c\n", ".context/context.yaml": "modules: []\n" })));
    expect(findings).toEqual([expect.objectContaining({ level: "error", file: ".context/tasks.md" })]);
  });

  test("a file at .context root other than README.md and tasks.md is an error", () => {
    const findings = contextLayout.run(contextFor(makeTree({ ...VALID_CONTEXT, ".context/TODO.md": "x" })));
    expect(findings).toEqual([expect.objectContaining({ level: "error", file: ".context/TODO.md" })]);
  });

  test("a folder outside the ten is an error", () => {
    const findings = contextLayout.run(contextFor(makeTree({ ...VALID_CONTEXT, ".context/documents/a.md": "x" })));
    expect(findings).toEqual([expect.objectContaining({ file: ".context/documents" })]);
  });

  test("context.yaml and context.local.yaml may sit at the root; other files may not", () => {
    const files = { ...VALID_CONTEXT, ".context/context.yaml": "kind: content\n", ".context/context.local.yaml": "{}\n" };
    expect(contextLayout.run(contextFor(makeTree(files)))).toEqual([]);
    expect(contextLayout.run(contextFor(makeTree({ ...files, ".context/other.yaml": "" })))).toEqual([expect.objectContaining({ file: ".context/other.yaml" })]);
  });

  test("a folder added under context.folders is allowed", () => {
    const yaml = "context:\n  folders:\n    - { folder: research, reason: interviews }\n";
    expect(contextLayout.run(contextFor(makeTree({ ...VALID_CONTEXT, ".context/research/a.md": "x", ".context/context.yaml": yaml })))).toEqual([]);
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

describe("context-layout additions", () => {
  test("empty folders, root strays, docs/, a live product's owed folders and a pointerless AGENTS.md are errors", () => {
    const messages = contextLayout
      .run(
        at({
          ...VALID_CONTEXT,
          ".context/designs/old/": "",
          ".context/ops/release.yml": "web:\n  live:\n    url: x\n",
          "TODO.md": "",
          "docs/a.md": "",
          "AGENTS.md": "# Agents\n",
        }),
      )
      .map((f) => `${f.file}: ${f.message}`);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/designs\/old: empty folder/),
        ".context/marketing: live (ops/release.yml) but no marketing/",
        expect.stringMatching(/^TODO.md:/),
        expect.stringMatching(/^docs\/:/),
        "AGENTS.md: does not point at .context/tasks.md",
      ]),
    );
  });

  test("AGENTS.md need not point at .context/tasks.md when .context/ is gitignored", () => {
    const ctx = at({ ...VALID_CONTEXT, "AGENTS.md": "# Agents\n", ".gitignore": ".context/\n" });
    execFileSync("git", ["init", "-q"], { cwd: ctx.repo });
    expect(contextLayout.run(ctx).filter((f) => f.file === "AGENTS.md")).toEqual([]);
  });

  test("live: null owes nothing", () => {
    const findings = contextLayout.run(at({ ...VALID_CONTEXT, ".context/ops/release.yml": "web:\n  live: null\n" }));
    expect(findings.filter((f) => /live/.test(f.message))).toEqual([]);
  });
});
