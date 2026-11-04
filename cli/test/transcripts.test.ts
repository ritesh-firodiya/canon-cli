import { utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { perTranscript, transcriptFiles } from "../src/lib/transcripts.ts";
import { makeTree } from "./helpers/fixture.ts";

test("each transcript is read once, and again only after it changes", () => {
  const root = makeTree({ "p/a.jsonl": "1", "p/s/subagents/b.jsonl": "2", "p/notes.txt": "x" });
  const cache = makeTree({});
  const files = transcriptFiles(root).sort();
  expect(files.map((f) => f.slice(root.length + 1))).toEqual(["p/a.jsonl", "p/s/subagents/b.jsonl"]);

  const reads: string[] = [];
  const read = (file: string) => (reads.push(file), file.length);
  perTranscript("t", files, read, cache);
  perTranscript("t", files, read, cache);
  expect(reads.length).toBe(2);

  writeFileSync(join(root, "p/a.jsonl"), "changed");
  utimesSync(join(root, "p/a.jsonl"), new Date(), new Date(Date.now() + 5000));
  perTranscript("t", files, read, cache);
  expect(reads.length).toBe(3);
});

test("only transcripts touched since a date are listed", () => {
  const root = makeTree({ "p/old.jsonl": "1", "p/new.jsonl": "2" });
  utimesSync(join(root, "p/old.jsonl"), new Date("2020-01-01"), new Date("2020-01-01"));
  expect(transcriptFiles(root, new Date("2025-01-01")).map((f) => f.endsWith("new.jsonl"))).toEqual([true]);
});
