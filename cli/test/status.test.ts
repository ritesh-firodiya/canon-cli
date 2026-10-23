import { describe, expect, test } from "vitest";
import { buildStatus } from "../src/status.ts";
import { makeTree } from "./helpers/fixture.ts";

describe("buildStatus", () => {
  test("shows zeno version, kind, modules, config sources and check counts", () => {
    const zeno = makeTree({ ".claude-plugin/plugin.json": JSON.stringify({ version: "9.9.9" }) });
    const repo = makeTree({ ".claude/zeno.yaml": "kind: content\nmodules: [docs]\n", ".cursorrules": "x" });
    const text = buildStatus(repo, { zenoRoot: zeno, estateRoot: repo });
    expect(text).toContain("zeno 9.9.9");
    expect(text).toContain("kind     content");
    expect(text).toContain("modules  docs");
    expect(text).toMatch(/config   product .*zeno\.yaml/);
    expect(text).toMatch(/checks   \d+ errors?, \d+ warnings?/);
  });

  test("says when there is no zeno.yaml yet", () => {
    const repo = makeTree({ "README.md": "" });
    expect(buildStatus(repo, { zenoRoot: repo, estateRoot: repo })).toContain("config   none — inferred; run `zeno init`");
  });
});
