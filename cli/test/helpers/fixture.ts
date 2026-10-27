import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Creates a throwaway directory holding `files` (path → content). A path ending in "/" is an empty folder. */
export function makeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "canon-test-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    if (path.endsWith("/")) {
      mkdirSync(full, { recursive: true });
      continue;
    }
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

export const VALID_CONTEXT = {
  ".context/README.md": "# context\n",
  ".context/tasks.md": "# Tasks\n",
  ".context/raw/.gitkeep": "",
  ".context/wiki/index.md": "# Index\n",
  ".context/features/index.md": "# Features\n",
  ".context/designs/mobile/routes.js": "window.ROUTES = {};\n",
};

export function wikiPage(fields: Record<string, string>, body = "## Summary\nx\n"): string {
  const front = Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join("\n");
  return `---\n${front}\n---\n\n${body}`;
}
