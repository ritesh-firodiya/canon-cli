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
        ".context/experiments/0001-retry-poc.md": page("id: EXP-0001\nkind: poc\nstatus: planned\nideas: [IDEA-0001]", "## Summary\ns\n"),
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

  test("an experiment is no longer a feature type", () => {
    expect(messages({ ".context/features/0001-a.md": page("id: FEAT-0001\ntype: experiment\nstatus: planned") })[0]).toMatch(/type experiment/);
  });

  test("missing fields and values outside the sets are errors", () => {
    expect(messages({ ".context/features/0001-scan.md": page("type: idea\nstatus: done") })).toEqual([
      "missing id",
      expect.stringMatching(/status done/),
      expect.stringMatching(/type idea/),
    ]);
    expect(messages({ ".context/problems/0001-a.md": page("id: PROB-0001\nstatus: open\nsource: email\npriority: urgent", "## Summary\ns\n## Impact\ni\n## Expected\ne\n") })[0]).toMatch(/priority urgent/);
  });

  test("the id must match the kind and the file number", () => {
    expect(messages({ ".context/ideas/0002-a.md": page("id: IDEA-0001\nstatus: draft", "## Summary\ns\n") })[0]).toMatch(/IDEA-0002/);
    expect(messages({ ".context/ideas/0001-a.md": page("id: FEAT-0001\nstatus: draft", "## Summary\ns\n") })[0]).toMatch(/IDEA-0001/);
  });

  test("a required section is an error when missing", () => {
    expect(messages({ ".context/plans/0001-a.md": page("id: PLAN-0001\nstatus: draft", "## Approach\na\n"), ".context/problems/0001-p.md": PROBLEM })).toContain("missing field problem");
    expect(messages({ ".context/problems/0001-p.md": PROBLEM, ".context/plans/0001-a.md": page("id: PLAN-0001\nstatus: draft\nproblem: PROB-0001", "## Approach\na\n") })).toEqual(["missing section ## Steps"]);
  });

  test("a finished experiment needs its result", () => {
    const done = (body: string) => ({ ".context/experiments/0001-a.md": page("id: EXP-0001\nkind: experiment\nstatus: done", body) });
    expect(messages(done("## Summary\ns\n"))).toEqual(["missing section ## Result"]);
    expect(messages(done("## Summary\ns\n## Result\nr\n"))).toEqual([]);
  });

  test("a link to a record that does not exist is an error", () => {
    expect(messages({ ".context/plans/0001-a.md": PLAN })).toEqual(["links to PROB-0001, which does not exist"]);
  });

  test("a plan or feature can run as an experiment, and records what happened", () => {
    const feature = (extra: string, body: string) => ({ ".context/features/0001-a.md": page(`id: FEAT-0001\ntype: feature\nstatus: shipped\nrelease: 1.0.0\n${extra}`, `## Store copy\n> A.\n${body}`) });
    expect(messages(feature("experiment: true", ""))).toEqual(["missing section ## Hypothesis", "missing section ## Metric"]);
    expect(messages(feature("experiment: true", "## Hypothesis\nh\n## Metric\nm\n"))).toEqual([]);
    expect(messages(feature("experiment: true\noutcome: discarded", "## Hypothesis\nh\n## Metric\nm\n"))).toEqual(["missing section ## Result"]);
    expect(messages(feature("experiment: true\noutcome: discarded", "## Hypothesis\nh\n## Metric\nm\n## Result\nr\n"))).toEqual([]);
    expect(messages(feature("outcome: maybe", ""))[0]).toMatch(/outcome maybe/);
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
