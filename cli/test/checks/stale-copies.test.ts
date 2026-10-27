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
});
