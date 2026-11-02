import { describe, expect, test } from "vitest";
import { records } from "../../src/checks/records.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const at = (files: Record<string, string>) => contextFor(makeTree(files), { today: new Date("2026-11-02") });
const page = (front: string, body = "") => `---\n${front}\n---\n${body}`;
const messages = (files: Record<string, string>) => records.run(at(files)).map((finding) => finding.message);

const PROBLEM = page("id: PROB-0001\nstatus: open\nsource: sentry\npriority: p1", "## Summary\ns\n## Impact\ni\n## Expected\ne\n");
const PLAN = page("id: PLAN-0001\nstatus: draft\nproblem: PROB-0001", "## Approach\na\n## Steps\ns\n");

describe("records", () => {
  test("a complete record of each kind passes", () => {
    expect(
      messages({
        ".context/problems/0001-checkout-fails.md": PROBLEM,
        ".context/ideas/0001-retry.md": page("id: IDEA-0001\nstatus: draft\nproblems: [PROB-0001]", "## Summary\ns\n"),
        ".context/experiments/retry-poc.md": page("name: retry-poc\nstatus: planned\nideas: [IDEA-0001]", "## Hypothesis\nh\n## Metric\nm\n"),
        ".context/plans/0001-retry.md": PLAN,
        ".context/features/0001-retry.md": page("id: FEAT-0001\ntype: feature\nstatus: planned\nplan: PLAN-0001"),
        ".context/bugs/0001-double-charge.md": page("id: BUG-0001\nstatus: open\nseverity: high\nplan: PLAN-0001", "## Summary\ns\n## Expected\ne\n## Actual\na\n"),
      }),
    ).toEqual([]);
  });

  test("a released feature needs its store copy; a chore does not", () => {
    const feature = (type: string, body = "") => ({ ".context/features/0001-scan.md": page(`id: FEAT-0001\ntype: ${type}\nstatus: shipped\nrelease: 1.2.0`, body) });
    expect(messages(feature("feature", "## Store copy\n> Scan a page.\n"))).toEqual([]);
    expect(messages(feature("feature"))[0]).toMatch(/Store copy/);
    expect(messages(feature("chore"))).toEqual([]);
  });

  test("a feature type outside its list fails", () => {
    expect(messages({ ".context/features/0001-a.md": page("id: FEAT-0001\ntype: experiment\nstatus: planned") })[0]).toMatch(/type experiment/);
  });

  test("only the id is required; a value that is present must fit", () => {
    expect(messages({ ".context/features/0001-scan.md": page("id: FEAT-0001") })).toEqual([]);
    expect(messages({ ".context/features/0001-scan.md": page("type: idea\nstatus: done") })).toEqual(["missing id", expect.stringMatching(/type idea/), expect.stringMatching(/status done/)]);
    expect(messages({ ".context/problems/0001-a.md": page("id: PROB-0001\npriority: urgent") })[0]).toMatch(/priority urgent/);
  });

  test("the id must match the kind and the file number", () => {
    expect(messages({ ".context/ideas/0002-a.md": page("id: IDEA-0001\nstatus: draft", "## Summary\ns\n") })[0]).toMatch(/IDEA-0002/);
    expect(messages({ ".context/ideas/0001-a.md": page("id: FEAT-0001\nstatus: draft", "## Summary\ns\n") })[0]).toMatch(/IDEA-0001/);
  });

  test("a repo requires what it wants: fields and sections", () => {
    const base = { ".context/context.yaml": 'records:\n  - { folder: plans, required: [problem, "## Steps"] }\n' };
    expect(messages({ ...base, ".context/plans/0001-a.md": page("id: PLAN-0001") })).toEqual(["missing field problem", "missing section ## Steps"]);
    expect(messages({ ...base, ".context/problems/0001-p.md": PROBLEM, ".context/plans/0001-a.md": PLAN })).toEqual([]);
  });

  test("a named experiment warns about missing sections, and does not block", () => {
    const run = (body: string, front = "status: done") => records.run(at({ ".context/experiments/a.md": page(`name: a\n${front}`, body) }));
    expect(run("## Hypothesis\nh\n## Metric\nm\n")).toEqual([expect.objectContaining({ level: "warn", message: "no ## Result section" })]);
    expect(run("## Hypothesis\nh\n## Metric\nm\n## Result\nr\n")).toEqual([]);
  });

  test("an experiment's name must match its file, and a link to it must resolve", () => {
    expect(messages({ ".context/experiments/a.md": page("name: b\nstatus: planned", "## Hypothesis\nh\n## Metric\nm\n") })[0]).toMatch(/name b should be a/);
    expect(messages({ ".context/features/0001-a.md": page("id: FEAT-0001\nexperiment: nope") })).toEqual(["links to nope, which does not exist"]);
  });

  test("two records cannot share an id", () => {
    const two = { ".context/ideas/0001-a.md": page("id: IDEA-0001"), ".context/ideas/0001-b.md": page("id: IDEA-0001") };
    expect(messages(two)).toEqual([expect.stringMatching(/used by more than one/), expect.stringMatching(/used by more than one/)]);
  });

  test("a link to a record that does not exist is an error", () => {
    expect(messages({ ".context/plans/0001-a.md": PLAN })).toEqual(["links to PROB-0001, which does not exist"]);
  });

  test("a record with an outcome should say what happened", () => {
    const feature = (extra: string, body = "") => records.run(at({ ".context/features/0001-a.md": page(`id: FEAT-0001\n${extra}`, body) }));
    expect(feature("outcome: discarded")).toEqual([expect.objectContaining({ level: "warn", message: "no ## Result section" })]);
    expect(feature("outcome: discarded", "## Result\nr\n")).toEqual([]);
    expect(feature("outcome: maybe")[0].message).toMatch(/outcome maybe/);
  });

  test("a repo can add, change and remove record kinds", () => {
    const yaml = [
      "records:",
      "  - { folder: campaigns, prefix: CAMP, statuses: [draft, live], fields: { channel: [email, ads] }, sections: [Goal] }",
      "  - { folder: bugs, statuses: [new, closed], sections: [Summary] }",
      "  - { folder: ideas, remove: true }",
      "",
    ].join("\n");
    const base = { ".context/context.yaml": yaml };
    expect(messages({ ...base, ".context/campaigns/0001-a.md": page("id: CAMP-0001\nstatus: draft\nchannel: ads", "## Goal\ng\n") })).toEqual([]);
    expect(messages({ ...base, ".context/campaigns/0001-a.md": page("id: CAMP-0001\nstatus: draft\nchannel: tv", "## Goal\ng\n") })[0]).toMatch(/channel tv/);
    expect(messages({ ...base, ".context/bugs/0001-a.md": page("id: BUG-0001\nstatus: new\nseverity: high", "## Summary\ns\n") })).toEqual([]);
    expect(messages({ ...base, ".context/bugs/0001-a.md": page("id: BUG-0001\nstatus: open\nseverity: high", "## Summary\ns\n") })[0]).toMatch(/status open/);
    expect(messages({ ...base, ".context/ideas/0001-a.md": "not checked" })).toEqual([]);
  });

  test("a link to a custom kind resolves", () => {
    const base = { ".context/context.yaml": "records:\n  - { folder: campaigns, prefix: CAMP, statuses: [draft], sections: [Goal] }\n" };
    expect(messages({ ...base, ".context/features/0001-a.md": page("id: FEAT-0001\ntype: feature\nstatus: planned\ncampaign: CAMP-0009") })).toEqual(["links to CAMP-0009, which does not exist"]);
  });
});
