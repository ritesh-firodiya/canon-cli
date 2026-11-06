import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { refs } from "../../src/enforce/checks/refs.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

function repoWith(files: Record<string, string>): string {
  const repo = makeTree(files);
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["add", "-A"], { cwd: repo });
  return repo;
}

const run = (files: Record<string, string>) => refs.run(contextFor(repoWith(files)));
const page = (body: string) => `---\nlast-verified: 2026-10-01\n---\n${body}\n`;

describe("refs", () => {
  test("a path that exists and a link to a page pass", () => {
    expect(
      run({
        ".context/wiki/concepts/a.md": page("See [b](b.md) and `.context/wiki/concepts/b.md`."),
        ".context/wiki/concepts/b.md": page("x"),
      }),
    ).toEqual([]);
  });

  test("a dead .context path is an error with file and line", () => {
    const findings = run({ "README.md": "intro\nsee .context/wiki/gone.md\n" });
    expect(findings).toEqual([expect.objectContaining({ level: "error", file: "README.md:2", message: ".context/wiki/gone.md does not exist" })]);
  });

  test("a [[slug]] link is an error that asks for a Markdown link", () => {
    const findings = run({ ".context/wiki/concepts/a.md": page("See [[b]], not `[[c]]`.") });
    expect(findings).toEqual([expect.objectContaining({ level: "error", file: ".context/wiki/concepts/a.md:4", message: expect.stringMatching(/\[\[b\]\].*relative Markdown link/) })]);
  });

  test("a relative Markdown link resolves beside its file; a dead one is a warning", () => {
    const findings = run({
      ".context/wiki/concepts/a.md": page("[b](../decisions/b.md#why), [web](https://x.dev/a.md) and [gone](gone.md)"),
      ".context/wiki/decisions/b.md": page("x"),
    });
    expect(findings).toEqual([expect.objectContaining({ level: "warn", file: ".context/wiki/concepts/a.md:4", message: "gone.md names no page yet" })]);
  });

  test("placeholders are checked only up to the last real folder", () => {
    expect(run({ "README.md": "pages are .context/wiki/<slug>.md\n", ".context/wiki/x.md": page("x") })).toEqual([]);
    expect(run({ "README.md": "pages are .context/nope/<slug>.md\n" })).toHaveLength(1);
  });

  test("dated records, git-history lines, ignored paths and copied files are skipped", () => {
    expect(
      run({
        "CHANGELOG.md": "moved .context/old/\n",
        ".context/ops/incidents/2026-01-01-x.md": "was .context/old/\n",
        "notes.md": "git show abc:.context/old/a.md\nbuilt to .context/listing/out/\n",
        ".gitignore": ".context/listing/out/\n",
        "scripts/shared.py": "default .context/designs/mobile\n",
        ".context/context.yaml": "copies:\n  source: ../src\n  sets:\n    designs: [scripts/shared.py]\n  use: [designs]\n",
      }),
    ).toEqual([]);
  });

  test("a copy set's to: path lands in other repos; only its from: path must exist here", () => {
    const set = ".context/context.yaml";
    const yaml = "copies:\n  sets:\n    shell:\n      - { from: .context/designs/mobile/a.js, to: .context/designs/web/a.js }\n";
    expect(run({ [set]: yaml, ".context/designs/mobile/a.js": "" })).toEqual([]);
    expect(run({ [set]: yaml })).toEqual([expect.objectContaining({ message: ".context/designs/mobile/a.js does not exist" })]);
  });

  test("a pipeline stage's done paths in context.yaml name what will exist later", () => {
    expect(run({ ".context/context.yaml": "pipelines:\n  default:\n    - { id: live, by: person, done: [.context/support] }\n" })).toEqual([]);
  });

  test("a local-only .context/ (listed in .gitignore) is checked from disk", () => {
    const findings = run({
      ".gitignore": ".context/\n",
      ".context/wiki/concepts/a.md": page("[b](b.md) [gone](nowhere.md) and .context/wiki/gone.md"),
      ".context/wiki/concepts/b.md": page("x"),
    });
    expect(findings).toEqual([
      expect.objectContaining({ level: "error", file: ".context/wiki/concepts/a.md:4", message: ".context/wiki/gone.md does not exist" }),
      expect.objectContaining({ level: "warn", message: "nowhere.md names no page yet" }),
    ]);
  });

  test("a .gitignore that lists .context/ before the folder exists has nothing to check", () => {
    expect(run({ ".gitignore": ".context/\n", "README.md": "intro\n" })).toEqual([]);
  });

  test("a folder that is not a git repo has nothing to check", () => {
    expect(refs.run(contextFor(makeTree({ "README.md": ".context/gone\n" })))).toEqual([]);
  });
});
