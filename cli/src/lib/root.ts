import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** canon's own folder (standards, templates): the nearest one up whose package.json is canon's, so src, dist and the plugin's bundle all find it. */
export function canonRootFrom(start: string): string {
  for (let dir = start; ; dir = dirname(dir)) {
    const file = join(dir, "package.json");
    if (existsSync(file) && (JSON.parse(readFileSync(file, "utf8")) as { name?: string }).name === "@freetesh/canon") return dir;
    if (dirname(dir) === dir) throw new Error(`canon cannot find its own folder above ${start}`);
  }
}

export const CANON_ROOT = canonRootFrom(import.meta.dirname);
