import { describe, expect, test } from "vitest";
import { contextLayout } from "../../src/checks/context-layout.ts";
import { features } from "../../src/checks/features.ts";
import { listing } from "../../src/checks/listing.ts";
import { tasks } from "../../src/checks/tasks.ts";
import { wikiFrontmatter } from "../../src/checks/wiki-frontmatter.ts";
import { makeTree, VALID_CONTEXT, wikiPage } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const TODAY = new Date("2026-10-23");
const at = (files: Record<string, string>) => contextFor(makeTree(files), { today: TODAY });

describe("tasks", () => {
  const blocked = (item: string) => ({ ".context/tasks.md": `# Tasks\n\n## Blocked\n${item}\n` });

  test("a blocked task with all three fields passes; a passed check date is a warning", () => {
    expect(tasks.run(at(blocked("- [ ] T005 Ship\n  blocked-by: Apple\n  unblock: wait\n  next-check: after T010")))).toEqual([]);
    const late = tasks.run(at(blocked("- [ ] T005 Ship\n  blocked-by: Apple\n  unblock: wait\n  next-check:2026-10-01")));
    expect(late).toEqual([expect.objectContaining({ level: "warn", message: expect.stringMatching(/T005 was to be checked/) })]);
  });

  test("a missing field, a missing id and a non-date are errors", () => {
    const findings = tasks.run(at(blocked("- [ ] T005 Ship\n  blocked-by: Apple\n  next-check: 2026-13-45\n- [ ] no id here")));
    expect(findings.map((f) => f.message)).toEqual([
      "T005 is blocked without unblock:",
      "T005 next-check: 2026-13-45 is not a date",
      "blocked item without a task id: - [ ] no id here",
    ]);
  });
});

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

describe("listing", () => {
  test("a well-formed tree passes", () => {
    const tree = {
      ".context/listing/android/metadata/en-US/title.txt": "x",
      ".context/listing/android/metadata/en-US/short_description.txt": "x",
      ".context/listing/android/metadata/en-US/full_description.txt": "x",
      ".context/listing/android/metadata/en-US/images/phoneScreenshots/01-home.png": "",
      ".context/listing/ios/metadata/review_information/notes.txt": "x",
    };
    expect(listing.run(at(tree))).toEqual([]);
  });

  test("a stray metadata folder, a missing text file, a bad image folder and an unpadded screenshot are errors", () => {
    const tree = {
      ".context/listing/android/metadata/en-US/title.txt": "x",
      ".context/listing/android/metadata/en-US/short_description.txt": "x",
      ".context/listing/android/metadata/en-US/images/shots/1-home.png": "",
      ".context/listing/android/metadata/en-US/images/phoneScreenshots/2-home.png": "",
      ".context/listing/ios/metadata/drafts/x.txt": "x",
    };
    const messages = listing.run(at(tree)).map((f) => `${f.file} ${f.message}`);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/ios\/metadata\/drafts not a locale/),
        expect.stringMatching(/full_description.txt missing/),
        expect.stringMatching(/images\/shots not a fastlane image folder/),
        expect.stringMatching(/phoneScreenshots\/2-home.png unpadded/),
      ]),
    );
  });
});

describe("context-layout additions", () => {
  test("empty folders, root strays, docs/, a live product's owed folders and a pointerless AGENTS.md are errors", () => {
    const messages = contextLayout
      .run(
        at({
          ...VALID_CONTEXT,
          ".context/designs/old/": "",
          ".context/ops/release.yml": "web:\n  live:\n    url: x\n",
          "TODO.md": "",
          "docs/a.md": "",
          "AGENTS.md": "# Agents\n",
        }),
      )
      .map((f) => `${f.file}: ${f.message}`);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/designs\/old: empty folder/),
        ".context/marketing: live (ops/release.yml) but no marketing/",
        expect.stringMatching(/^TODO.md:/),
        expect.stringMatching(/^docs\/:/),
        "AGENTS.md: does not point at .context/tasks.md",
      ]),
    );
  });

  test("live: null owes nothing", () => {
    const findings = contextLayout.run(at({ ...VALID_CONTEXT, ".context/ops/release.yml": "web:\n  live: null\n" }));
    expect(findings.filter((f) => /live/.test(f.message))).toEqual([]);
  });
});

describe("wiki-frontmatter", () => {
  test("a last-verified date in the future is an error", () => {
    const findings = wikiFrontmatter.run(at({ ".context/wiki/concepts/a.md": wikiPage({ "last-verified": "2027-01-01" }) }));
    expect(findings).toEqual([expect.objectContaining({ level: "error", message: expect.stringMatching(/in the future/) })]);
  });
});
