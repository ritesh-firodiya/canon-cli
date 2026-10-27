import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { sharedFiles, syncCopies } from "../../src/checks/shared-files.ts";
import { loadConfig } from "../../src/config/load.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const ESTATE = `estate: true
copies:
  source: source
  sets:
    upload: [scripts/upload.mjs]
    shell-web:
      - { from: designs/mobile/shell.html, to: designs/web/shell.html, named: true }
      - { from: designs/mobile/shared.css, to: designs/web/shared.css, until: "PALETTE" }
`;

/** An estate with a source product and one product using `use`; `files` are the product's files. */
function estate(use: string[], files: Record<string, string>) {
  const root = makeTree({
    ".claude/zeno.yaml": ESTATE,
    "source/.context/README.md": "# .context — Charades\n",
    "source/scripts/upload.mjs": "upload v2\n",
    "source/designs/mobile/shell.html": "<title>Charades</title>\n",
    "source/designs/mobile/shared.css": "core v2\nPALETTE — Charades\nred\n",
    "app/.context/README.md": "# .context — Imposter\n",
    ...Object.fromEntries(Object.entries(files).map(([path, text]) => [`app/${path}`, text])),
  });
  mkdirSync(join(root, "app", ".claude"), { recursive: true });
  writeFileSync(join(root, "app", ".claude", "zeno.yaml"), use.length ? `copies:\n  use: [${use.join(", ")}]\n` : "{}\n");
  return join(root, "app");
}

const run = (repo: string) => sharedFiles.run(contextFor(repo, { config: loadConfig(repo).config }));
const SHELL = { "designs/web/shell.html": "<title>Imposter</title>\n", "designs/web/shared.css": "core v2\nPALETTE — Imposter\nviolet\n" };

describe("shared-files", () => {
  test("the sets a product uses match: same bytes, the name swapped, the shared block above the marker", () => {
    expect(run(estate(["upload", "shell-web"], { "scripts/upload.mjs": "upload v2\n", ...SHELL }))).toEqual([]);
  });

  test("a product that uses no set is not checked, whatever files it carries", () => {
    expect(run(estate([], { "scripts/upload.mjs": "our own\n" }))).toEqual([]);
  });

  test("a drifted copy is an error naming the source and the fix", () => {
    const findings = run(estate(["upload"], { "scripts/upload.mjs": "upload v1\n" }));
    expect(findings).toEqual([expect.objectContaining({ file: "scripts/upload.mjs", message: expect.stringMatching(/differs from source.*--sync/) })]);
  });

  test("a set in use whose file is missing, and an unknown set name, are errors", () => {
    expect(run(estate(["upload"], {}))).toEqual([expect.objectContaining({ file: "scripts/upload.mjs", message: expect.stringMatching(/^missing — set upload/) })]);
    expect(run(estate(["uploads"], {}))).toEqual([expect.objectContaining({ message: "copies.use names uploads, which no copies.sets defines" })]);
  });

  test("below the until marker is the product's own", () => {
    const drifted = { ...SHELL, "designs/web/shared.css": "core v1\nPALETTE — Imposter\nviolet\n" };
    expect(run(estate(["shell-web"], drifted))).toEqual([expect.objectContaining({ file: "designs/web/shared.css" })]);
  });

  test("--sync rewrites drifted copies, keeps the product's own block and name, and adds nothing", () => {
    const repo = estate(["upload", "shell-web"], { "scripts/upload.mjs": "upload v1\n", "designs/web/shell.html": "<title>old</title>\n", "designs/web/shared.css": "core v1\nPALETTE — Imposter\nviolet\n" });
    expect(syncCopies(repo, loadConfig(repo).config).sort()).toEqual(["designs/web/shared.css", "designs/web/shell.html", "scripts/upload.mjs"]);
    expect(readFileSync(join(repo, "designs/web/shell.html"), "utf8")).toBe("<title>Imposter</title>\n");
    expect(readFileSync(join(repo, "designs/web/shared.css"), "utf8")).toBe("core v2\nPALETTE — Imposter\nviolet\n");
    expect(run(repo)).toEqual([]);
  });

  test("a shared block whose marker is gone is drift that --sync leaves alone", () => {
    const repo = estate(["shell-web"], { ...SHELL, "designs/web/shared.css": "everything mixed\n" });
    expect(run(repo)).toHaveLength(1);
    expect(syncCopies(repo, loadConfig(repo).config)).toEqual([]);
  });

  test("the source repo itself is not checked", () => {
    const repo = estate(["upload"], {});
    expect(run(join(repo, "..", "source"))).toEqual([]);
  });
});
