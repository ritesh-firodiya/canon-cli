import { describe, expect, test } from "vitest";
import { features } from "../../src/checks/features.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const TODAY = new Date("2026-10-23");
const at = (files: Record<string, string>) => contextFor(makeTree(files), { today: TODAY });

describe("features", () => {
  const feature = (front: string, body = "") => ({ ".context/features/0001-scan.md": `---\n${front}\n---\n${body}` });

  test("a complete feature passes; a released one needs its store copy", () => {
    expect(features.run(at(feature("id: FEAT-0001\ntype: feature\nstatus: shipped\nrelease: 1.2.0", "## Store copy\n> Scan a page.\n")))).toEqual([]);
    expect(features.run(at(feature("id: FEAT-0001\ntype: feature\nstatus: shipped\nrelease: 1.2.0")))[0].message).toMatch(/Store copy/);
    expect(features.run(at(feature("id: FEAT-0001\ntype: chore\nstatus: shipped\nrelease: 1.2.0")))).toEqual([]);
  });

  test("missing fields and values outside the sets are errors", () => {
    const messages = features.run(at(feature("type: idea\nstatus: done"))).map((f) => f.message);
    expect(messages).toEqual(["missing id", expect.stringMatching(/type idea/), expect.stringMatching(/status done/)]);
  });
});
