import { describe, expect, test } from "vitest";
import { staleCopies } from "../../src/checks/stale-copies.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

describe("stale-copies", () => {
  test("agent instruction files for tools not in use are warnings", () => {
    const repo = makeTree({ ".github/copilot-instructions.md": "x", ".cursorrules": "x", "AGENTS.md": "x" });
    const files = staleCopies.run(contextFor(repo)).map((f) => f.file);
    expect(files).toEqual([".github/copilot-instructions.md", ".cursorrules"]);
  });

  test("a short pointer to AGENTS.md is not a copy; a long one still is", () => {
    const pointer = "Read AGENTS.md at the repo root.\n";
    const long = `See AGENTS.md.\n${"rule\n".repeat(15)}`;
    const repo = makeTree({ ".github/copilot-instructions.md": pointer, ".cursorrules": long, ".windsurfrules": "short, no pointer\n" });
    const files = staleCopies.run(contextFor(repo)).map((f) => f.file);
    expect(files).toEqual([".cursorrules", ".windsurfrules"]);
  });
});
