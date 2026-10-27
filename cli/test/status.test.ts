import { describe, expect, test } from "vitest";
import { buildStatus } from "../src/status.ts";
import { makeTree } from "./helpers/fixture.ts";

describe("buildStatus", () => {
  test("shows canon version, kind, modules, config sources and check counts", () => {
    const canon = makeTree({ ".claude-plugin/plugin.json": JSON.stringify({ version: "9.9.9" }) });
    const repo = makeTree({ ".claude/canon.yaml": "kind: content\nmodules: [docs]\n", ".cursorrules": "x" });
    const text = buildStatus(repo, { canonRoot: canon });
    expect(text).toContain("canon 9.9.9");
    expect(text).toContain("kind     content");
    expect(text).toContain("modules  docs");
    expect(text).toMatch(/config   product .*canon\.yaml/);
    expect(text).toMatch(/checks   \d+ errors?, \d+ warnings?/);
  });

  test("says when there is no canon.yaml yet", () => {
    const repo = makeTree({ "README.md": "" });
    expect(buildStatus(repo, { canonRoot: repo })).toContain("config   none — inferred; run `canon init`");
  });
});
