import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { proposals, readDecisions, readVerdicts, recordDecision } from "../src/learn.ts";
import { makeTree } from "./helpers/fixture.ts";

const line = (principles: string[], reason: string, request = "r") =>
  JSON.stringify({ at: "2026-10-01T00:00:00Z", verdict: "push-back", principles, request, reason });

function estate() {
  return makeTree({
    "a/.context/raw/zeno/verdicts.jsonl": [line(["C-07"], "demo tomorrow"), line(["C-07", "C-02"], "client asked")].join("\n") + "\n",
    "b/.context/raw/zeno/verdicts.jsonl": line(["C-07"], "demo tomorrow") + "\nnot json\n",
    "c/.context/README.md": "",
  });
}

describe("readVerdicts", () => {
  test("reads every product's log, tags the product, and skips broken lines", () => {
    const root = estate();
    const entries = readVerdicts([join(root, "a"), join(root, "b"), join(root, "c")]);
    expect(entries.map((e) => e.product)).toEqual(["a", "a", "b"]);
  });
});

describe("proposals", () => {
  const root = estate();
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

describe("recordDecision", () => {
  test("appends to the estate's decisions log and reads it back", () => {
    const estate = makeTree({});
    recordDecision(estate, { id: "principle:C-07", decision: "rejected", count: 3, note: "cost rule is fine" });
    expect(readDecisions(estate)).toEqual([expect.objectContaining({ id: "principle:C-07" })]);
    const saved = readFileSync(join(estate, ".claude/zeno/decisions.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(saved).toEqual([expect.objectContaining({ id: "principle:C-07", decision: "rejected", count: 3 })]);
  });
});
