import { describe, expect, test } from "vitest";
import { canonicalValues } from "../../src/checks/canonical-values.ts";
import { makeTree, wikiPage } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const entity = (table: string) =>
  wikiPage({ id: "PACKS.ALL", type: "entity", status: "canonical", "last-verified": "2026-10-01" }, `## Canonical values\n${table}\n`);
const surface = (body: string) =>
  wikiPage({ id: "SURFACE.MOBILE.BUNDLE", type: "surface", status: "canonical", "last-verified": "2026-10-01" }, body);

function run(files: Record<string, string>) {
  return canonicalValues.run(contextFor(makeTree(files)));
}

describe("canonical-values", () => {
  test("a price that an entity holds passes", () => {
    expect(
      run({
        ".context/wiki/entities/packs.md": entity("| PRICE.PACK | $1.99 | 2026-10-01 |"),
        ".context/wiki/surfaces/bundle.md": surface("Each pack is $1.99."),
      }),
    ).toEqual([]);
  });

  test("a price that only a non-entity page states is a warning naming the page", () => {
    const findings = run({
      ".context/wiki/entities/packs.md": entity("| NAME | Classic |"),
      ".context/wiki/surfaces/bundle.md": surface("Each pack is $1.99 and a bundle $6.99."),
    });
    expect(findings).toEqual([
      expect.objectContaining({ level: "warn", file: ".context/wiki/surfaces/bundle.md", message: expect.stringMatching(/\$1\.99, \$6\.99/) }),
    ]);
  });

  test("only surface pages are checked — concepts may use example amounts", () => {
    const concept = wikiPage({ id: "CONCEPT.TAX", type: "concept", status: "canonical" }, "A gain of ₹1,20,000 is taxed at 12.5%.");
    expect(run({ ".context/wiki/concepts/tax.md": concept })).toEqual([]);
  });

  test("rupee amounts count too, and a price inside a code block does not", () => {
    const findings = run({
      ".context/wiki/surfaces/plan.md": surface("Plan costs ₹249.\n\n```\n| PRICE | ₹999 |\n```\n"),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/₹249/);
    expect(findings[0].message).not.toMatch(/₹999/);
  });

  test("an amount in a paragraph that is not about price is an example, not a price", () => {
    const page = surface("Ravi paid ₹6,200 for dinner and Asha owes ₹1,600.\n\nThe Pro plan costs ₹249\na year, or ₹29 a month.");
    const findings = run({ ".context/wiki/surfaces/split.md": page });
    expect(findings).toEqual([expect.objectContaining({ message: expect.stringMatching(/^₹249, ₹29 /) })]);
  });

  test("superseded pages are ignored", () => {
    const old = wikiPage({ id: "SURFACE.OLD", type: "surface", status: "superseded", "superseded-by": "SURFACE.NEW" }, "Was $4.99.");
    expect(run({ ".context/wiki/surfaces/old.md": old })).toEqual([]);
  });
});
