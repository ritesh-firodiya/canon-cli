import { describe, expect, test } from "vitest";
import { diagrams, diagramsJson } from "../../src/checks/diagrams.ts";
import { makeTree } from "../helpers/fixture.ts";
import type { CheckContext } from "../../src/checks/types.ts";

const good = {
  diagram_type: "architecture",
  meta: { title: "1 · Who uses it" },
  components: [
    { id: "a", label: "A", pos: [0, 0], size: [100, 50] },
    { id: "b", label: "B", pos: [200, 0], size: [100, 50] },
  ],
  connections: [{ id: "x", from: "a", to: "b", label: "calls" }],
};
const at = (name: string) => `.context/architecture/${name}.json`;
const run = (files: Record<string, string>) => diagrams.run({ repo: makeTree(files) } as CheckContext);

describe("diagrams check", () => {
  test("passes a repo with no diagrams, and a valid one", () => {
    expect(run({ "README.md": "" })).toEqual([]);
    expect(run({ [at("who-uses")]: JSON.stringify(good) })).toEqual([]);
  });

  test("fails JSON that does not parse", () => {
    const [finding] = run({ [at("bad")]: "{" });
    expect(finding).toMatchObject({ level: "error", file: at("bad") });
  });

  test("fails a missing title, an undrawable part and a connection to a part that does not exist", () => {
    const messages = run({
      [at("bad")]: JSON.stringify({
        ...good,
        meta: {},
        components: [good.components[0], { id: "b", label: "B" }],
        connections: [{ id: "x", from: "a", to: "gone" }],
      }),
    }).map((finding) => finding.message);
    expect(messages).toEqual(["no meta.title", 'part "b" needs a label, pos and size', 'connection "x" points at "gone", which is not a part']);
  });

  test("warns on a type the shell cannot draw", () => {
    const [finding] = run({ [at("flow")]: JSON.stringify({ diagram_type: "sequence", meta: { title: "t" } }) });
    expect(finding).toMatchObject({ level: "warn", file: at("flow") });
  });

  test("warns on a diagram still in the wiki", () => {
    const [finding] = run({ ".context/wiki/concepts/architecture/who-uses.json": JSON.stringify(good) });
    expect(finding).toMatchObject({ level: "warn", file: ".context/wiki/concepts/architecture/who-uses.json" });
  });
});

describe("diagramsJson", () => {
  test("lists diagrams by file name and leaves out broken ones", () => {
    const repo = makeTree({ [at("b")]: JSON.stringify(good), [at("a")]: JSON.stringify(good), [at("broken")]: "{" });
    expect(JSON.parse(diagramsJson(repo)).map((diagram: { name: string }) => diagram.name)).toEqual(["a", "b"]);
  });

  test("is an empty list with no folder", () => {
    expect(JSON.parse(diagramsJson(makeTree({ "README.md": "" })))).toEqual([]);
  });
});
