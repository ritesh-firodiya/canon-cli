import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** Every file under `dir` whose name matches `test`, as paths relative to `root`. Missing dir → []. */
export function listFiles(root: string, dir: string, test: (name: string) => boolean): string[] {
  const start = join(root, dir);
  if (!existsSync(start)) return [];
  const found: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      // A linked folder counts as a folder, so a gate's copy of the repo reads like the repo.
      if (entry.isDirectory() || (entry.isSymbolicLink() && isDirectory(full))) walk(full);
      else if (test(entry.name)) found.push(relative(root, full));
    }
  };
  walk(start);
  return found.sort();
}

export function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

/** The product a path is in: the nearest folder above it, or itself, that holds a .context. */
export function productRoot(start: string): string | null {
  let folder = resolve(start);
  while (!existsSync(join(folder, ".context"))) {
    if (dirname(folder) === folder) return null;
    folder = dirname(folder);
  }
  return folder;
}
