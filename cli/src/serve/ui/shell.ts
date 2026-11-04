import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The loader a page's `<script src="shell.js">` gets, pointed at the shell served from `base`. */
export function loaderAt(canonRoot: string, base: string): string {
  return readFileSync(join(canonRoot, "shell", "loader.js"), "utf8").replace("{shell}", base);
}
