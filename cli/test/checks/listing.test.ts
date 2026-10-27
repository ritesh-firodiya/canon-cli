import { describe, expect, test } from "vitest";
import { listing } from "../../src/checks/listing.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const TODAY = new Date("2026-10-23");
const at = (files: Record<string, string>) => contextFor(makeTree(files), { today: TODAY });

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
