import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The line of a set's shell.js that says where the shell is. */
const SHELL_LINE = /var SHELL = "([^"]*)";/;
const PINNED = /@freetesh\/canon@([^/]+)\/shell\//;

/** canon as npm publishes it: the version a set's loader pins. */
export function packageVersion(canonRoot: string): string {
  return JSON.parse(readFileSync(join(canonRoot, "package.json"), "utf8")).version;
}

/** The loader a design set holds, pinned to `version` of the published shell. */
export function loaderFor(canonRoot: string, version: string): string {
  return readFileSync(join(canonRoot, "shell", "loader.js"), "utf8").replace("{version}", version);
}

/** The version a set's loader pins, or null when it is not canon's loader. */
export function pinnedVersion(canonRoot: string, source: string): string | null {
  const version = PINNED.exec(source)?.[1];
  return version && source === loaderFor(canonRoot, version) ? version : null;
}

/** The same loader pointed at the shell `canon ui` serves. */
export function servedLoader(source: string, base: string): string {
  return source.replace(SHELL_LINE, `var SHELL = "${base}";`);
}
