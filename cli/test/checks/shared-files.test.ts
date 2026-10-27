import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { sharedFiles, syncCopies } from "../../src/checks/shared-files.ts";
import { loadConfig } from "../../src/config/load.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const ESTATE = `estate: true
copies:
  source: source
  files:
    - scripts/upload.mjs
    - { from: designs/mobile/shell.html, to: [designs/mobile/shell.html, designs/web/shell.html], named: true }
    - { from: designs/mobile/shared.css, to: [designs/mobile/shared.css], until: "PALETTE" }
`;

/** An estate with a source product and one product; `product` adds or replaces the product's files. */
function estate(product: Record<string, string>) {
  const root = makeTree({
    ".claude/zeno.yaml": ESTATE,
    "source/.context/README.md": "# .context — Charades\n",
    "source/scripts/upload.mjs": "upload v2\n",
    "source/designs/mobile/shell.html": "<title>Charades</title>\n",
    "source/designs/mobile/shared.css": "core v2\nPALETTE — Charades\nred\n",
    "app/.context/README.md": "# .context — Imposter\n",
    ...Object.fromEntries(Object.entries(product).map(([path, text]) => [`app/${path}`, text])),
  });
  mkdirSync(join(root, "app", ".claude"), { recursive: true });
  return join(root, "app");
}

function run(repo: string) {
  return sharedFiles.run(contextFor(repo, { config: loadConfig(repo).config }));
}

describe("shared-files", () => {
  test("identical copies, a named copy and a matching shared block pass", () => {
    const repo = estate({
      "scripts/upload.mjs": "upload v2\n",
      "designs/mobile/shell.html": "<title>Imposter</title>\n",
      "designs/mobile/shared.css": "core v2\nPALETTE — Imposter\nviolet\n",
    });
    expect(run(repo)).toEqual([]);
  });

  test("a drifted copy is an error naming the source and the fix", () => {
    const findings = run(estate({ "scripts/upload.mjs": "upload v1\n" }));
    expect(findings).toEqual([
      expect.objectContaining({ level: "error", file: "scripts/upload.mjs", message: expect.stringMatching(/differs from source.*--sync/) }),
    ]);
  });

  test("a plain path the product lacks is missing unless skipped with a reason; a mapped one is optional", () => {
    expect(run(estate({}))).toEqual([expect.objectContaining({ file: "scripts/upload.mjs", message: expect.stringMatching(/^missing/) })]);
    const skipped = estate({ ".claude/zeno.yaml": "copies:\n  skip:\n    - { file: scripts/upload.mjs, reason: no Play app }\n" });
    expect(run(skipped)).toEqual([]);
  });

  test("a skipped file is not compared even when present", () => {
    const repo = estate({
      "scripts/upload.mjs": "our own\n",
      ".claude/zeno.yaml": "copies:\n  skip:\n    - { file: scripts/upload.mjs, reason: own copy for the monorepo }\n",
    });
    expect(run(repo)).toEqual([]);
  });

  test("below the until marker is the product's own", () => {
    const repo = estate({ "scripts/upload.mjs": "upload v2\n", "designs/mobile/shared.css": "core v1\nPALETTE — Imposter\nviolet\n" });
    expect(run(repo)).toEqual([expect.objectContaining({ file: "designs/mobile/shared.css" })]);
  });

  test("--sync rewrites drifted copies, keeps the product's own block and its name, and adds nothing", () => {
    const repo = estate({
      "scripts/upload.mjs": "upload v1\n",
      "designs/web/shell.html": "<title>old</title>\n",
      "designs/mobile/shared.css": "core v1\nPALETTE — Imposter\nviolet\n",
    });
    const written = syncCopies(repo, loadConfig(repo).config);
    expect(written.sort()).toEqual(["designs/mobile/shared.css", "designs/web/shell.html", "scripts/upload.mjs"]);
    expect(readFileSync(join(repo, "designs/web/shell.html"), "utf8")).toBe("<title>Imposter</title>\n");
    expect(readFileSync(join(repo, "designs/mobile/shared.css"), "utf8")).toBe("core v2\nPALETTE — Imposter\nviolet\n");
    expect(run(repo)).toEqual([]);
  });

  test("a shared block whose marker is gone is drift that --sync leaves alone", () => {
    const repo = estate({ "scripts/upload.mjs": "upload v2\n", "designs/mobile/shared.css": "everything mixed\n" });
    expect(run(repo)).toHaveLength(1);
    expect(syncCopies(repo, loadConfig(repo).config)).toEqual([]);
  });

  test("the source repo itself and an estate with no copies are not checked", () => {
    const repo = estate({});
    expect(run(join(repo, "..", "source"))).toEqual([]);
    expect(run(makeTree({ "README.md": "" }))).toEqual([]);
  });
});
