import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Every file under `dir` whose name matches `test`, as paths relative to `root`. Missing dir → []. */
export function listFiles(root: string, dir: string, test: (name: string) => boolean): string[] {
  const start = join(root, dir);
  if (!existsSync(start)) return [];
  const found: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (test(entry.name)) found.push(relative(root, full));
    }
  };
  walk(start);
  return found.sort();
}

export function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}
