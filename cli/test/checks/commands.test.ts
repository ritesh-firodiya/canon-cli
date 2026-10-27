import { describe, expect, test } from "vitest";
import { commandChecks } from "../../src/checks/commands.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

function run(files: Record<string, string>) {
  return commandChecks.run(contextFor(makeTree(files)));
}

describe("commands (the repo's own checkers, declared in canon.yaml)", () => {
  test("no commands declared means nothing to run", () => {
    expect(run({ "README.md": "" })).toEqual([]);
  });

  test("a passing command yields no findings", () => {
    expect(run({ ".claude/canon.yaml": "commands:\n  - { id: ok, run: 'true' }\n" })).toEqual([]);
  });

  test("a failing command is one error under its own id, carrying its output", () => {
    const findings = run({ ".claude/canon.yaml": "commands:\n  - { id: links, run: 'echo href missing: a.html; exit 1' }\n" });
    expect(findings).toEqual([
      expect.objectContaining({ check: "links", level: "error", message: "href missing: a.html" }),
    ]);
  });

  test("a command with `module` runs only in a repo that uses that module", () => {
    const yaml = (modules: string) => `modules: [${modules}]\ncommands:\n  - { id: designs-first, run: 'exit 1', module: code }\n`;
    expect(run({ ".claude/canon.yaml": yaml("docs") })).toEqual([]);
    expect(run({ ".claude/canon.yaml": yaml("docs, code") })).toEqual([expect.objectContaining({ check: "designs-first" })]);
  });

  test("a command with `kinds` runs only in a repo of those kinds; mobile-and-web counts as both", () => {
    const yaml = (kind: string) => `kind: ${kind}\ncommands:\n  - { id: designs-first, run: 'exit 1', kinds: [mobile, web] }\n`;
    expect(run({ ".claude/canon.yaml": yaml("package") })).toEqual([]);
    expect(run({ ".claude/canon.yaml": yaml("web") })).toEqual([expect.objectContaining({ check: "designs-first" })]);
    expect(run({ ".claude/canon.yaml": yaml("mobile-and-web") })).toEqual([expect.objectContaining({ check: "designs-first" })]);
  });

  test("a command with `if` runs only when that path exists, from the repo root", () => {
    const findings = run({
      ".claude/canon.yaml": "commands:\n  - { id: web, run: 'ls site; exit 1', if: site }\n  - { id: mobile, run: 'exit 1', if: app }\n",
      "site/page.html": "",
    });
    expect(findings).toEqual([expect.objectContaining({ check: "web", file: "site", message: "page.html" })]);
  });
});
