import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { pipeline } from "../../src/checks/pipeline.ts";
import { GATES_LOG, readApprovals, recordApproval, stagesOf } from "../../src/pipeline.ts";
import { loadConfig } from "../../src/config/load.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const PIPELINE = [
  "pipeline:",
  "  - { id: designs, done: [.context/designs/mobile/index.html], gate: true }",
  "  - { id: scaffold, done: [app.config.ts] }",
  "  - { id: schema, done: [firestore.rules], gate: true }",
  "  - { id: build, done: [src, app] }",
  "",
].join("\n");
const DESIGNS = { ".context/designs/mobile/index.html": "" };

function run(files: Record<string, string>) {
  return pipeline.run(contextFor(makeTree({ ".claude/canon.yaml": PIPELINE, ...files })));
}

describe("pipeline", () => {
  test("a repo with no pipeline in its config passes", () => {
    expect(pipeline.run(contextFor(makeTree({ "app.config.ts": "" })))).toEqual([]);
  });

  test("work inside the first gated stage passes before it is approved", () => {
    expect(run(DESIGNS)).toEqual([]);
  });

  test("a later stage started before an earlier gate is approved is an error", () => {
    expect(run({ ...DESIGNS, "app.config.ts": "" })).toEqual([
      expect.objectContaining({ level: "error", file: "app.config.ts", message: expect.stringContaining("canon approve designs") }),
    ]);
  });

  test("each unapproved gate is reported once, at the first stage after it", () => {
    const findings = run({ ...DESIGNS, "app.config.ts": "", "firestore.rules": "", "src/index.ts": "" });
    expect(findings.map((f) => [f.file, f.message.match(/approve (\w+)/)?.[1]])).toEqual([
      ["app.config.ts", "designs"],
      ["src", "schema"],
    ]);
  });

  test("any one of a stage's done paths marks it started", () => {
    // build started with both earlier gates unapproved: one finding per gate, both at app/.
    expect(run({ ...DESIGNS, "app/index.tsx": "" }).map((f) => f.file)).toEqual(["app", "app"]);
  });

  test("an approved gate lets later stages start", () => {
    const repo = makeTree({ ".claude/canon.yaml": PIPELINE, ...DESIGNS, "app.config.ts": "" });
    recordApproval(repo, "designs", "reviewed all screens");
    expect(pipeline.run(contextFor(repo))).toEqual([]);
  });
});

describe("approvals", () => {
  test("an approval is appended with its date and note, never rewritten", () => {
    const repo = makeTree({});
    recordApproval(repo, "designs", "first pass");
    recordApproval(repo, "schema", "");
    expect(readApprovals(repo)).toEqual([
      expect.objectContaining({ stage: "designs", note: "first pass", at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) }),
      expect.objectContaining({ stage: "schema" }),
    ]);
    expect(readFileSync(join(repo, GATES_LOG), "utf8").trim().split("\n")).toHaveLength(2);
  });
  test("stagesOf lists every stage in order with where it started and its gate", () => {
    const repo = makeTree({ ".claude/canon.yaml": PIPELINE, ...DESIGNS, src: "" });
    recordApproval(repo, "designs", "");
    const stages = stagesOf(repo, loadConfig(repo, { estateRoot: null }).config.pipeline);
    expect(stages.map((s) => [s.id, s.startedAt, s.approved])).toEqual([
      ["designs", ".context/designs/mobile/index.html", true],
      ["scaffold", null, null],
      ["schema", null, false],
      ["build", "src", null],
    ]);
  });
});
