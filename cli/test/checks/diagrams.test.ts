import { describe, expect, test } from "vitest";
import { architectureJson, diagrams } from "../../src/checks/diagrams.ts";
import { makeTree } from "../helpers/fixture.ts";
import type { CheckContext } from "../../src/checks/types.ts";

const FILE = ".context/architecture/architecture.json";
const TODAY = new Date("2026-10-30");
const good = {
  schema_version: 2,
  verified: "2026-10-30",
  summary: "A phone app.",
  headlines: [{ label: "Known cost", value: "$8", note: "Apple fee" }],
  areas: [{ id: "phone", label: "On the phone" }, { id: "outside", label: "Outside" }],
  parts: [
    { id: "app", area: "phone", label: "App", does: "the app", cost: { today: "$0", grows: "nothing", basis: "stated", source: "[[stack]]" } },
    { id: "model", area: "outside", label: "Model", does: "reads", cost: { today: "Not read", grows: "scans", basis: "unknown" } },
  ],
  flows: [{ name: "Scan", cost: "$0.001", path: ["app", "model"], steps: ["send"] }],
};
const run = (architecture: unknown, extra: Record<string, string> = {}) =>
  diagrams.run({ repo: makeTree({ [FILE]: typeof architecture === "string" ? architecture : JSON.stringify(architecture), ...extra }), today: TODAY } as CheckContext);
const messages = (architecture: unknown) => run(architecture).map((finding) => finding.message);

describe("architecture check", () => {
  test("passes a repo with no file, and a valid one", () => {
    expect(diagrams.run({ repo: makeTree({ "README.md": "" }), today: TODAY } as CheckContext)).toEqual([]);
    expect(run(good)).toEqual([]);
  });

  test("fails JSON that does not parse", () => {
    expect(run("{")[0]).toMatchObject({ level: "error", file: FILE });
  });

  test("fails a missing summary, and a part in an area that does not exist", () => {
    const parts = [{ ...good.parts[0], area: "gone" }, good.parts[1]];
    expect(messages({ ...good, summary: "", parts })).toEqual(["no summary", 'part "app" is in area "gone", which does not exist']);
  });

  test("fails a cost with no basis, and a basis with no source", () => {
    const parts = [
      { ...good.parts[0], cost: { today: "$1", grows: "x" } },
      { ...good.parts[1], cost: { today: "$1", grows: "x", basis: "measured" } },
    ];
    expect(messages({ ...good, parts })).toEqual(['part "app" cost has no valid basis', 'part "model" cost is "measured" but names no source']);
  });

  test("fails a number marked unknown", () => {
    const parts = [good.parts[0], { ...good.parts[1], cost: { today: "$5", grows: "x", basis: "unknown" } }];
    expect(messages({ ...good, parts })).toEqual(['part "model" cost is "unknown" but states a number: $5']);
  });

  test("fails a flow through a part that does not exist", () => {
    expect(messages({ ...good, flows: [{ name: "Scan", cost: "$0", path: ["app", "gone"], steps: ["x"] }] })).toEqual(['flow "Scan" goes through "gone", which is not a part']);
  });

  test("warns when the file has not been verified for 90 days", () => {
    expect(run({ ...good, verified: "2026-01-01" })[0]).toMatchObject({ level: "warn", file: FILE });
  });

  test("warns on the old diagrams", () => {
    const old = { diagram_type: "architecture", meta: { title: "t" } };
    expect(diagrams.run({ repo: makeTree({ ".context/architecture/who-uses.json": JSON.stringify(old) }), today: TODAY } as CheckContext)[0]).toMatchObject({ level: "warn" });
    expect(diagrams.run({ repo: makeTree({ ".context/wiki/concepts/architecture/who-uses.json": "{}" }), today: TODAY } as CheckContext)[0]).toMatchObject({ level: "warn" });
  });
});

describe("architectureJson", () => {
  test("returns the file, or null when there is none", () => {
    expect(JSON.parse(architectureJson(makeTree({ [FILE]: JSON.stringify(good) }))).summary).toBe("A phone app.");
    expect(JSON.parse(architectureJson(makeTree({ "README.md": "" })))).toBeNull();
  });
});
