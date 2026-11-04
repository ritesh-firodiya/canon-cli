import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { locks } from "../src/enforce/checks/locks.ts";
import { loadConfig } from "../src/config/load.ts";
import { makeTree } from "./helpers/fixture.ts";
import { contextFor } from "./helpers/context.ts";

const ORG = "cap: 10\nlocked: [pipelines.default.review, records.bugs]\nrecords:\n  - { folder: bugs, statuses: [open, closed] }\npipelines:\n  default:\n    - { id: build, by: agent }\n    - { id: review, by: agent, gate: true }\n";
const PRODUCT = "extends: [org.yaml]\ncap: 5\npipelines:\n  hotfix:\n    - { id: fix, by: agent }\n";
const TEAM = "extends: [product.yaml]\nteam: growth\nconnectors:\n  - { id: sentry, via: cli }\n";

function tree(repoYaml: string, local?: string) {
  const root = makeTree({
    "rules/org.yaml": ORG,
    "rules/product.yaml": PRODUCT,
    "rules/team.yaml": TEAM,
    "app/.context/context.yaml": `extends: [../../rules/team.yaml]\n${repoYaml}`,
    ...(local ? { "app/.context/context.local.yaml": local } : {}),
  });
  return join(root, "app");
}

describe("rule layers", () => {
  test("organization, product, team, repo, machine: the closest wins", () => {
    expect(loadConfig(tree("")).config.cap).toBe(5);
    expect(loadConfig(tree("cap: 2")).config.cap).toBe(2);
    expect(loadConfig(tree("cap: 2", "cap: 1")).config.cap).toBe(1);
    expect(loadConfig(tree("")).config.team).toBe("growth");
  });

  test("lists with ids merge, and a named pipeline adds to the others", () => {
    const { config, sources } = loadConfig(tree("connectors:\n  - { id: acme, via: api }\n"));
    expect(config.connectors.map((entry) => entry.id)).toEqual(["sentry", "acme"]);
    expect(Object.keys(config.pipelines)).toEqual(["default", "hotfix"]);
    expect(sources.map((source) => source.layer)).toEqual(["extends", "extends", "extends", "product"]);
  });

  test("a lower layer cannot remove or change what a higher one locked", () => {
    const check = (yaml: string) => locks.run(contextFor(tree(yaml)));
    expect(check("cap: 2")).toEqual([]);
    expect(check("pipelines:\n  default:\n    - { id: build, by: agent }\n")[0].message).toMatch(/pipelines.default.review is locked by .*org.yaml/);
    expect(check("pipelines:\n  default:\n    - { id: review, by: agent, gate: false }\n")[0].message).toMatch(/locked/);
    expect(check("records:\n  - { folder: bugs, remove: true }\n")[0].message).toMatch(/records.bugs/);
    expect(check("pipelines:\n  default:\n    - { id: build, by: person }\n    - { id: review, by: agent, gate: true }\n")).toEqual([]);
  });

  test("a missing or circular layer is an error", () => {
    expect(() => loadConfig(tree("extends: [nope.yaml]\n"))).toThrow();
    const root = makeTree({ "a.yaml": "extends: [b.yaml]\n", "b.yaml": "extends: [a.yaml]\n", "app/.context/context.yaml": "extends: [../../a.yaml]\n" });
    expect(() => loadConfig(join(root, "app"))).toThrow(/circle/);
  });

  test("a stage naming a default id inherits what it does not set, and can change it", () => {
    const { config } = loadConfig(makeTree({ ".context/context.yaml": "pipelines:\n  default:\n    - { id: plan, cap: 2 }\n    - { id: store-review, done: [x] }\n" }));
    const [plan, store] = config.pipelines.default;
    expect(plan).toMatchObject({ gate: true, by: "agent", cap: 2, done: [".context/plans"] });
    expect(plan.prompt).toMatch(/weigh/);
    expect(store).toMatchObject({ gate: false, done: ["x"] });
    expect(store.by).toBeUndefined();
  });

  test("with no pipeline set, canon's default flow applies", () => {
    const { config } = loadConfig(makeTree({ ".context/context.yaml": "kind: package\n" }));
    expect(config.pipelines.default.map((stage) => stage.id)).toEqual(["intake", "problem", "idea", "discovery", "prioritize", "collect", "research", "design", "plan", "feature", "code", "review", "release", "outcome"]);
  });
});
