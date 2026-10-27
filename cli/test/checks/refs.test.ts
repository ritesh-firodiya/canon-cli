import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { refs } from "../../src/checks/refs.ts";
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
        ".context/wiki/concepts/a.md": page("See [[b]] and `.context/wiki/concepts/b.md`."),
        ".context/wiki/concepts/b.md": page("x"),
      }),
    ).toEqual([]);
  });

  test("a dead .context path is an error with file and line", () => {
    const findings = run({ "README.md": "intro\nsee .context/wiki/gone.md\n" });
    expect(findings).toEqual([expect.objectContaining({ level: "error", file: "README.md:2", message: ".context/wiki/gone.md does not exist" })]);
  });

  test("a link to a page not yet written is a warning; a feature id resolves", () => {
    const findings = run({
      ".context/wiki/concepts/a.md": page("[[nowhere]] and [[FEAT-0002]]"),
      ".context/features/0002-scan.md": "x",
    });
    expect(findings).toEqual([expect.objectContaining({ level: "warn", message: "[[nowhere]] names no page yet" })]);
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
        ".claude/canon.yaml": "copies:\n  source: ../src\n  sets:\n    designs: [scripts/shared.py]\n  use: [designs]\n",
      }),
    ).toEqual([]);
  });

  test("a pipeline stage's done paths in canon.yaml name what will exist later", () => {
    expect(run({ ".claude/canon.yaml": "pipeline:\n  - { id: live, done: [.context/support] }\n" })).toEqual([]);
  });

  test("a folder that is not a git repo has nothing to check", () => {
    expect(refs.run(contextFor(makeTree({ "README.md": ".context/gone\n" })))).toEqual([]);
  });
});
