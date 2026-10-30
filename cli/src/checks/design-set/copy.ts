import { readdirSync } from "node:fs";
import { join } from "node:path";
import { flat, isDir, isFile, read, sorted } from "./text.ts";
import type { Surface } from "./set.ts";

// A dialog drawn by the OS has no route and no layout of ours to get wrong, so it slips past every structural
// check. This one reads the words every Alert.alert and toast puts on screen and looks for them in the set.

const KEYWORDS = new Set(["cancel", "destructive", "default", "plain", "success", "error", "warning", "warn", "info", "ask", "neutral"]);
const STRING = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
// A code inside the call (`'invalid-vpa'`) or a callable an option invokes (`removeFamilyMember`) is not copy.
const CODE = /^(?:[a-z0-9]+(?:-[a-z0-9]+)+|[a-z]+(?:[A-Z][a-z0-9]*)+)$/;
// A template literal is mostly interpolation, and has to go before single-quoted strings are read, or the
// apostrophe in `${x} isn't valid` opens a string that runs to the next one.
const TEMPLATE = /`(?:[^`\\]|\\.)*`/g;
const T_CALL = /\bt\(\s*["']([\w.-]+)["']\s*\)/g;

function isCopy(text: string): boolean {
  if (KEYWORDS.has(text.toLowerCase()) || !/[A-Za-z]/.test(text) || text.length < 2) return false;
  if (CODE.test(text)) return false;
  // A word someone reads contains a space or is a bare word; "image/png" and "public.png" are neither.
  return text.includes(" ") || !/[/:._]/.test(text);
}

/** An app that translates raises keys, not words: each `t("key")` is read as the English sentence it names. */
function dictionary(s: Surface): Map<string, string> {
  const file = join(s.srcDir, "i18n", "en.ts");
  if (!isFile(file)) return new Map();
  const entry = /["']([\w.-]+)["']\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
  return new Map([...read(file).matchAll(entry)].map((m) => [m[1], m[2] ?? m[3]]));
}

/** The arguments of the call whose open paren is at `open`. */
function callArguments(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")" && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}

/** Every .ts and .tsx under dir, dot folders included, folder by folder. */
function sources(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = sorted(entries.filter((e) => e.isFile() && /\.tsx?$/.test(e.name)).map((e) => e.name)).map((name) => join(dir, name));
  return [...files, ...sorted(entries.filter((e) => e.isDirectory()).map((e) => e.name)).flatMap((name) => sources(join(dir, name)))];
}

export function copy(s: Surface): void {
  s.report.head("copy — every string a dialog or a toast shows appears in the set");
  if (!isDir(s.appDir)) {
    s.report.say(`   skipped — no app at ${s.appDir}`);
    return;
  }
  const drawn = flat([...sorted(s.onDisk), ...s.defs].map((f) => read(join(s.dir, f))).join(" "));
  const words = dictionary(s);
  const raisers = s.web ? /(?:\btoast|window\.confirm)\(/g : /(?:Alert\.alert|showToast)\(/g;
  const before = s.report.fail;
  let checked = 0;
  for (const path of sources(s.srcDir)) {
    const text = read(path);
    for (const m of text.matchAll(raisers)) {
      const call = callArguments(text, (m.index as number) + m[0].length - 1).replace(T_CALL, (whole, key: string) => (words.has(key) ? JSON.stringify(words.get(key)) : whole));
      for (const lit of call.replace(TEMPLATE, "").matchAll(STRING)) {
        const piece = flat((lit[1] ?? lit[2]).replaceAll('\\"', '"').replaceAll("\\'", "'"));
        if (!isCopy(piece)) continue;
        checked += 1;
        if (!drawn.includes(piece)) s.report.bad(`src/${path.slice(s.srcDir.length + 1)} puts "${piece.length < 60 ? piece : `${piece.slice(0, 57)}...`}" on screen and no wireframe draws it`);
      }
    }
  }
  const undrawn = s.report.fail - before;
  s.report.say(`   ${checked} dialog and toast strings checked${undrawn ? `, ${undrawn} undrawn` : ", all drawn"}`);
}
