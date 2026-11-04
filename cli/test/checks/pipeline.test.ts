import { describe, expect, test } from "vitest";
import { pipeline } from "../../src/enforce/checks/pipeline.ts";
import { loadConfig } from "../../src/config/load.ts";
import { approveStage, stagesOf } from "../../src/work/pipeline/pipeline.ts";
import { findRecord } from "../../src/work/records/records.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const YAML = "pipelines:\n  default:\n    - { id: plan, done: [.context/plans], gate: true }\n    - { id: build, by: agent }\n    - { id: ship, by: person }\n";
const page = (extra: string) => `---\nid: PROB-0001\nstatus: solving\nsource: person\npriority: p2\n${extra}\n---\n## Summary\ns\n## Impact\ni\n## Expected\ne\n`;
const FILE = ".context/problems/0001-a.md";
const run = (files: Record<string, string>) => pipeline.run(contextFor(makeTree({ ".context/context.yaml": YAML, ...files })));

describe("pipeline check", () => {
  test("a record may sit at a gate, but cannot pass it unapproved", () => {
    expect(run({ [FILE]: page("stage: plan") })).toEqual([]);
    expect(run({ [FILE]: page("stage: build\ncompleted: [plan]") })[0].message).toMatch(/gate "plan"/);
  });

  test("an approval or a skipped stage lets it pass", () => {
    expect(run({ [FILE]: page("stage: build\ncompleted: [plan]\napprovals:\n  - { stage: plan, by: me, at: 2026-11-02 }") })).toEqual([]);
    expect(run({ [FILE]: page("stage: build\nskipped:\n  - { stage: plan, reason: no }") })).toEqual([]);
  });

  test("a stage behind a record must be done or skipped with a reason, however it got there", () => {
    expect(run({ [FILE]: page("stage: ship\ncompleted: [plan]\napprovals:\n  - { stage: plan, by: me, at: x }") })[0].message).toMatch(/"build" neither done nor skipped/);
  });

  test("a stage with verify cannot pass without its check", () => {
    const yaml = "pipelines:\n  default:\n    - { id: build, by: agent, verify: [\"https://x.example.com\"] }\n    - { id: ship, by: person }\n";
    const at = (extra: string) => pipeline.run(contextFor(makeTree({ ".context/context.yaml": yaml, [FILE]: page(extra) })));
    expect(at("stage: ship\ncompleted: [build]")[0].message).toMatch(/no check against/);
    expect(at("stage: ship\ncompleted: [build]\nverified: [build]")).toEqual([]);
  });

  test("verify must name a connector or an address", () => {
    const yaml = "pipelines:\n  default:\n    - { id: build, by: agent, verify: [nope] }\n";
    expect(pipeline.run(contextFor(makeTree({ ".context/context.yaml": yaml })))[0].message).toMatch(/verifies against nope/);
  });

  test("a record naming a missing pipeline is an error", () => {
    expect(run({ [FILE]: page("pipeline: nope") })[0].message).toMatch(/pipeline nope/);
  });

  test("a trigger must name a real source and pipeline", () => {
    const yaml = (source: string, more = "") => `connectors:\n  - { id: sentry, via: cli }\ntriggers:\n  - { id: t, source: ${source}, when: x${more} }\n`;
    const check = (text: string) => pipeline.run(contextFor(makeTree({ ".context/context.yaml": text })));
    expect(check(yaml("sentry"))).toEqual([]);
    expect(check(yaml("schedule"))).toEqual([]);
    expect(check(yaml("datadog"))[0].message).toMatch(/datadog/);
    expect(check(yaml("sentry", ", pipeline: nope"))[0].message).toMatch(/nope/);
  });
});

describe("approvals", () => {
  test("go on the record, name the person, and only for stages that need one", () => {
    const repo = makeTree({ ".context/context.yaml": YAML, [FILE]: page("stage: plan") });
    const { config } = loadConfig(repo);
    approveStage(repo, config, "PROB-0001", "plan", "ritesh", "read it", new Date("2026-11-02T00:00:00Z"));
    expect(findRecord(repo, config, "PROB-0001").data.approvals).toEqual([{ stage: "plan", by: "ritesh", at: "2026-11-02T00:00:00.000Z", note: "read it" }]);
    expect(() => approveStage(repo, config, "PROB-0001", "build", "ritesh", "")).toThrow(/needs no approval/);
    expect(stagesOf(repo, config).find((stage) => stage.id === "plan")).toMatchObject({ approved: true, startedAt: null });
  });

  test("the body of the page is left as written", () => {
    const repo = makeTree({ ".context/context.yaml": YAML, [FILE]: page("stage: plan") });
    const { config } = loadConfig(repo);
    approveStage(repo, config, "PROB-0001", "plan", "me", "");
    expect(findRecord(repo, config, "PROB-0001").body).toBe("## Summary\ns\n## Impact\ni\n## Expected\ne\n");
  });
});
