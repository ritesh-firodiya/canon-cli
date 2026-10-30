import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const read = (path: string): string => readFileSync(path, "utf8");
export const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile();
export const isDir = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();

/** Every file under dir as a path relative to it, sorted; dot folders and files are skipped, as a shell glob does. */
export function walk(dir: string): string[] {
  if (!isDir(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((path) => !path.split("/").some((part) => part.startsWith(".")) && isFile(join(dir, path)))
    .sort();
}

/** Code-point order, the order every list in the report is printed in. */
export const sorted = <T extends string>(items: Iterable<T>): T[] => [...new Set(items)].sort();

// shortcut: the named entities the design sets use, not the full HTML5 table; add one when a set draws it.
const ENTITIES: Record<string, string> = {
  amp: "&", quot: '"', lt: "<", gt: ">", apos: "'", nbsp: " ", middot: "·", times: "×", copy: "©",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…",
  bull: "•", asymp: "≈", rarr: "→", larr: "←", deg: "°", reg: "®", trade: "™",
};

function unescape(text: string): string {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, name: string) => {
    if (name.startsWith("#")) {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[name] ?? whole;
  });
}

const PLAIN: [string, string][] = [["’", "'"], ["‘", "'"], ["“", '"'], ["”", '"'], ["—", "-"], ["–", "-"], [" ", " "]];

/** Straight vs curly, entity vs character, one line vs wrapped: the same sentence is written three ways across .tsx and .html, so both sides are flattened before they are compared. */
export function flat(text: string): string {
  let out = unescape(text);
  for (const [from, to] of PLAIN) out = out.replaceAll(from, to);
  return out.replace(/\s+/g, " ").trim();
}

const HOLE = /\{!?[a-z][a-z0-9-]*(?:=[^?|}]*)?(?:\|[^}]*|\?([^:}]*)(?::([^}]*))?)?\}/g;

/** A definition with its {prop} holes out and both arms of every {test?a:b} in. */
export const unbrace = (text: string): string => text.replace(HOLE, (_m, a?: string, b?: string) => ` ${[a, b].filter(Boolean).join(" ")} `);

/** Every class="" in text, as [classes, prefixes]. Both arms of a {test?a:b} are classes; a class built from a {prop} is known only by its prefix. */
export function classes(text: string): [Set<string>, Set<string>] {
  const joined = [...text.matchAll(/class="([^"]*)"/g)].map((m) => m[1]).join(" ");
  const words = joined.replace(/\{!?[a-z][\w-]*(?:=[^?|}]*)?\?([^:}]*)(?::([^}]*))?\}/g, (_m, a: string, b?: string) => ` ${a} ${b ?? ""} `).split(/\s+/).filter(Boolean);
  const fixed = new Set(words.filter((w) => !w.includes("{")));
  const prefixes = new Set(words.filter((w) => w.includes("{")).map((w) => w.split("{")[0]).filter(Boolean));
  return [fixed, prefixes];
}
