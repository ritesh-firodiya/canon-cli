import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { constitutionTitles, resolveStandards } from "../src/standards.ts";
import { makeTree } from "./helpers/fixture.ts";

const zeno = () =>
  makeTree({
    "standards/constitution.md": "# C\n\n### C-01 Ship\nx\n### C-02 Write less\n",
    "standards/wiki-schema.md": "zeno schema",
    "standards/README.md": "index, not a standard",
  });

describe("resolveStandards", () => {
  test("zeno's defaults first, then each configured folder; a later file of the same name wins", () => {
    const root = zeno();
    const estate = makeTree({ "wiki-schema.md": "estate schema", "design-sets.md": "designs" });
    const found = resolveStandards(root, [estate]);
    expect(found).toEqual([
      { name: "constitution", path: join(root, "standards/constitution.md"), from: "zeno" },
      { name: "design-sets", path: join(estate, "design-sets.md"), from: estate },
      { name: "wiki-schema", path: join(estate, "wiki-schema.md"), from: estate },
    ]);
  });

  test("an estate constitution is listed beside zeno's, because it extends rather than replaces", () => {
    const root = zeno();
    const estate = makeTree({ "constitution.md": "### C-20 More\n" });
    expect(resolveStandards(root, [estate]).filter((s) => s.name === "constitution").map((s) => s.from)).toEqual(["zeno", estate]);
  });

  test("a configured folder that does not exist is an error naming it", () => {
    expect(() => resolveStandards(zeno(), ["/no/such/dir"])).toThrow(/\/no\/such\/dir/);
  });
});

describe("constitutionTitles", () => {
  test("reads principle headings from every constitution in order, estate additions after zeno's", () => {
    const root = zeno();
    const estate = makeTree({ "constitution.md": "### C-01 Ship\n### C-20 Designs before code\n" });
    expect(constitutionTitles(root, [estate])).toEqual(["C-01 Ship", "C-02 Write less", "C-20 Designs before code"]);
  });
});
