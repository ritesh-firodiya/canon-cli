import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { proposals, readDecisions, readVerdicts, recordDecision, summarise } from "../src/learn/learn/learn.ts";
import { formatVerdict, parseVerdicts, recordVerdict, type Outcome } from "../src/work/records/verdicts.ts";
import { loadConfig } from "../src/config/load.ts";
import { findRecord } from "../src/work/records/records.ts";
import { makeTree } from "./helpers/fixture.ts";

const page = (...verdicts: [string[], string][]) =>
  `---\nid: IDEA-0001\nstatus: accepted\n---\n## Summary\ns\n\n## Verdict\n${verdicts
    .map(([principles, reason]) => formatVerdict({ at: "2026-10-01T00:00:00Z", verdict: "push-back", outcome: "overridden", principles, request: "r", reason, terms: [] }))
    .join("\n")}\n`;

function workspace() {
  return makeTree({
    "a/.context/ideas/0001-x.md": page([["C-07"], "demo tomorrow"], [["C-07", "C-02"], "client asked"]),
    "b/.context/plans/0001-y.md": page([["C-07"], "demo tomorrow"]),
    "c/.context/README.md": "",
  });
}

describe("readVerdicts", () => {
  test("reads the verdict on every record in every product, and tags the product", () => {
    const root = workspace();
    const entries = readVerdicts([join(root, "a"), join(root, "b"), join(root, "c")]);
    expect(entries.map((e) => e.product)).toEqual(["a", "a", "b"]);
  });
});

describe("proposals", () => {
  const root = workspace();
  const entries = readVerdicts([join(root, "a"), join(root, "b")]);

  test("a principle overridden at least `threshold` times becomes a proposal", () => {
    const found = proposals(entries, { threshold: 3, decisions: [] });
    expect(found).toContainEqual(
      expect.objectContaining({ id: "principle:C-07", count: 3, products: ["a", "b"] }),
    );
    expect(found.some((p) => p.id === "principle:C-02")).toBe(false);
  });

  test("the same reason given in two products becomes a proposal", () => {
    const found = proposals(entries, { threshold: 99, decisions: [] });
    expect(found).toEqual([expect.objectContaining({ id: "reason:demo tomorrow", count: 2, products: ["a", "b"] })]);
  });

  test("a rejected proposal stays hidden until new evidence arrives", () => {
    const rejected = [{ id: "principle:C-07", decision: "rejected" as const, count: 3, at: "", note: "" }];
    expect(proposals(entries, { threshold: 3, decisions: rejected }).some((p) => p.id === "principle:C-07")).toBe(false);
    const more = [...entries, { ...entries[0], product: "c" }];
    expect(proposals(more, { threshold: 3, decisions: rejected }).some((p) => p.id === "principle:C-07")).toBe(true);
  });
});

describe("every verdict is logged, only overrides teach", () => {
  const entry = (verdict: string, outcome: Outcome, principles: string[] = ["C-07"], reason = "") => formatVerdict({ at: "2026-10-02T00:00:00Z", verdict, outcome, principles, request: "r", reason, terms: [] });
  const root = makeTree({
    "a/.context/ideas/0001-x.md": `---\nid: IDEA-0001\nstatus: accepted\n---\n## Summary\ns\n\n## Verdict\n${[
      entry("push-back", "overridden", ["C-07"], "demo tomorrow"),
      entry("do-it", "proceeded"),
      entry("push-back", "stopped"),
      entry("push-back", "stopped"),
      entry("push-back", "dropped"),
    ].join("\n")}\n`,
  });
  const entries = readVerdicts([join(root, "a")]);

  test("a verdict the user followed is never counted as an override", () => {
    expect(proposals(entries, { threshold: 1, decisions: [] }).map((p) => p.id)).toEqual(["principle:C-07"]);
    expect(proposals(entries, { threshold: 1, decisions: [] })[0].count).toBe(1);
  });

  test("the summary counts verdicts, stops and overrides", () => {
    expect(summarise(entries)).toEqual({ total: 5, proceeded: 1, stopped: 2, overridden: 1, dropped: 1 });
  });
});

describe("recordDecision", () => {
  test("appends to the decisions log in the home folder and reads it back", () => {
    const home = makeTree({});
    recordDecision(home, { id: "principle:C-07", decision: "rejected", count: 3, note: "cost rule is fine" });
    expect(readDecisions(home)).toEqual([expect.objectContaining({ id: "principle:C-07" })]);
    const saved = readFileSync(join(home, ".claude/canon/decisions.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(saved).toEqual([expect.objectContaining({ id: "principle:C-07", decision: "rejected", count: 3 })]);
  });
});

describe("recordVerdict", () => {
  const verdict = { at: "2026-11-02T00:00:00Z", verdict: "do-it-differently", outcome: "overridden" as const, principles: ["C-01"], request: "Build a canvas", reason: "client asked", terms: ["no canvas yet"] };

  test("goes on the record it judged, and reads back whole", () => {
    const repo = makeTree({ ".context/plans/0001-a.md": "---\nid: PLAN-0001\nstatus: draft\nproblem: PROB-0001\n---\n## Approach\na\n\n## Steps\ns\n" });
    recordVerdict(repo, loadConfig(repo).config, verdict, "PLAN-0001");
    const { body } = findRecord(repo, loadConfig(repo).config, "PLAN-0001");
    expect(body).toMatch(/## Steps\ns\n\n## Verdict\n- 2026-11-02/);
    expect(parseVerdicts(body)).toEqual([{ ...verdict, at: "2026-11-02" }]);
  });

  test("with no record, a dropped request becomes a dropped Idea", () => {
    const repo = makeTree({ ".context/README.md": "" });
    const saved = recordVerdict(repo, loadConfig(repo).config, { ...verdict, outcome: "stopped" });
    expect(saved.id).toBe("IDEA-0001");
    expect(findRecord(repo, loadConfig(repo).config, "IDEA-0001").data.status).toBe("dropped");
  });
});
