import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { constitutionTitles, resolveStandards } from "../src/standards.ts";
import { makeTree } from "./helpers/fixture.ts";

const canon = () =>
  makeTree({
    "standards/constitution.md": "# C\n\n### C-01 Ship\nx\n### C-02 Write less\n",
    "standards/wiki-schema.md": "canon schema",
    "standards/README.md": "index, not a standard",
    "standards/library/pipeline.md": "# Pipeline\n\n### C-16 Designs before code\n",
  });

describe("resolveStandards", () => {
  test("canon's defaults first, then each configured folder; a later file of the same name wins", () => {
    const root = canon();
    const estate = makeTree({ "wiki-schema.md": "estate schema", "design-sets.md": "designs" });
    const found = resolveStandards(root, [estate]);
    expect(found).toEqual([
      { name: "constitution", path: join(root, "standards/constitution.md"), from: "canon" },
      { name: "design-sets", path: join(estate, "design-sets.md"), from: estate },
      { name: "wiki-schema", path: join(estate, "wiki-schema.md"), from: estate },
    ]);
  });

  test("an estate constitution is listed beside canon's, because it extends rather than replaces", () => {
    const root = canon();
    const estate = makeTree({ "constitution.md": "### C-20 More\n" });
    expect(resolveStandards(root, [estate]).filter((s) => s.name === "constitution").map((s) => s.from)).toEqual(["canon", estate]);
  });

  test("a bare name imports canon's library standard; an unknown name lists what canon has", () => {
    const root = canon();
    expect(resolveStandards(root, ["pipeline"]).map((s) => [s.name, s.from])).toEqual([
      ["constitution", "canon"],
      ["pipeline", "canon library"],
      ["wiki-schema", "canon"],
    ]);
    expect(() => resolveStandards(root, ["expo"])).toThrow(/no canon standard named expo — canon has: pipeline/);
  });

  test("a configured folder that does not exist is an error naming it", () => {
    expect(() => resolveStandards(canon(), ["/no/such/dir"])).toThrow(/\/no\/such\/dir/);
  });
});

describe("constitutionTitles", () => {
  test("reads principle headings from every constitution in order, estate additions after canon's", () => {
    const root = canon();
    const estate = makeTree({ "constitution.md": "### C-01 Ship\n### C-20 Designs before code\n" });
    expect(constitutionTitles(root, [estate])).toEqual(["C-01 Ship", "C-02 Write less", "C-20 Designs before code"]);
  });

  test("an imported library standard adds its principles", () => {
    expect(constitutionTitles(canon(), ["pipeline"])).toEqual(["C-01 Ship", "C-02 Write less", "C-16 Designs before code"]);
  });
});
