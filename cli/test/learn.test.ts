import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { proposals, readDecisions, readVerdicts, recordDecision, summarise } from "../src/learn/learn/learn.ts";
import { formatVerdict, parseVerdicts, recordVerdict, reworkRates, type Outcome } from "../src/work/records/verdicts.ts";
import { weighReport } from "../src/learn/usage/cost.ts";
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

  test("with no record, work that simply went ahead is logged, not made a page, and still counted", () => {
    const home = makeTree({});
    const before = process.env.CANON_HOME;
    process.env.CANON_HOME = home;
    try {
      const repo = makeTree({ ".context/README.md": "" });
      const saved = recordVerdict(repo, loadConfig(repo).config, { ...verdict, outcome: "proceeded" });
      expect(saved.id).toBe("logged");
      expect(existsSync(join(repo, ".context/ideas"))).toBe(false);
      expect(readVerdicts([repo]).map((v) => v.outcome)).toEqual(["proceeded"]);
    } finally {
      if (before === undefined) delete process.env.CANON_HOME;
      else process.env.CANON_HOME = before;
    }
  });
});

describe("weigh measures", () => {
  const base = { at: "2026-11-04T09:00:00Z", verdict: "do-it", outcome: "proceeded" as const, principles: ["C-01"], request: "r", reason: "", terms: [] };

  test("size and claims round-trip, and a line written before them still parses", () => {
    const text = `## Verdict\n${formatVerdict({ ...base, size: "large", claims: { backed: 2, total: 5 } })}\n${formatVerdict(base)}\n`;
    const [withMeasures, old] = parseVerdicts(text);
    expect(withMeasures).toMatchObject({ size: "large", claims: { backed: 2, total: 5 } });
    expect(old.size).toBeUndefined();
    expect(old.claims).toBeUndefined();
  });

  test("rework is counted apart for records with and without a weigh verdict", () => {
    const record = (id: string, contradicted: boolean, verdict: boolean) =>
      `---\nid: ${id}\n${contradicted ? "contradicted: 2026-11-05\n" : ""}---\n## Summary\ns\n${verdict ? `\n## Verdict\n${formatVerdict(base)}\n` : ""}`;
    const root = makeTree({
      "a/.context/ideas/0001-x.md": record("IDEA-0001", true, true),
      "a/.context/ideas/0002-y.md": record("IDEA-0002", false, true),
      "a/.context/features/0001-z.md": record("FEAT-0001", true, false),
    });
    const repo = join(root, "a");
    expect(reworkRates([repo], () => loadConfig(repo).config)).toEqual({ withWeigh: { records: 2, contradicted: 1 }, withoutWeigh: { records: 1, contradicted: 1 } });
  });

  test("verdict outcomes join the transcript week they fall in, and old ones are left out", () => {
    const week = { week: "2026-11-02", sessions: 10, weighRuns: 2, weighBlocks: 1 };
    const verdicts = [
      { ...base, product: "a" },
      { ...base, outcome: "stopped" as const, product: "a" },
      { ...base, at: "2026-10-01T00:00:00Z", product: "a" },
    ];
    const rework = { withWeigh: { records: 0, contradicted: 0 }, withoutWeigh: { records: 0, contradicted: 0 } };
    expect(weighReport([week], verdicts, new Date("2026-10-15T00:00:00Z"), rework).weeks).toEqual([{ ...week, proceeded: 1, stopped: 1, overridden: 0, dropped: 0 }]);
  });
});
