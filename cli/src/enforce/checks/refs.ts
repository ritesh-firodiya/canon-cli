import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, normalize } from "node:path";
import { CONFIG_FILE } from "../../config/schema.ts";
import { usedCopies } from "./shared-files.ts";
import type { Check, Finding } from "./types.ts";

// A `.context/` path not preceded by something that makes it part of a longer one (another
// product's, an absolute path, a URL). A leading `./` means "beside this file".
const PATH = /(?<![\w/~.-])(\.\/)?(\.context\/[\w./@+-]*)/g;
const PLACEHOLDER = /[<{*[$]|YYYY|NNNN/;
const LINK = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
// A line reading a path out of git history names it as it was.
const FROM_HISTORY = /git (show|checkout|log|diff|restore)\b/;
// Dated records keep a path as it was on the day.
const DATED = /(^|\/)CHANGELOG\.md$|^\.context\/ops\/incidents\//;
const BINARY = /\.(png|jpe?g|gif|webp|ico|icns|mp4|mov|pdf|zip|aab|apk|jks|keystore|p8|p12|ttf|otf|woff2?|lock|snap|sqlite|db|bin)$|(^|\/)pnpm-lock\.yaml$/i;
const FEATURE_FILE = /^\.context\/features\/(\d{4})-[^/]+\.md$/;
// A pipeline stage's `done:` paths name what will exist once that stage starts.
const STAGE_DONE = /^\s*-\s*\{[^}]*\bdone:\s*\[/;
// A copy set's `to:` path is where the file lands in the products that copy it, not in this repo.
const COPY_TO = /,\s*to:.*$/;

function git(repo: string, args: string[]): { status: number; stdout: string } {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status ?? 1, stdout: result.stdout ?? "" };
}

/** Every file under `.context/`, read from disk: a local-only `.context/` has no tracked files. */
function onDisk(repo: string): string[] {
  const root = join(repo, ".context");
  if (!existsSync(root)) return [];
  return (readdirSync(root, { recursive: true }) as string[])
    .map((path) => `.context/${path}`)
    .filter((path) => statSync(join(repo, path)).isFile());
}

/** The part of a path that names something real: cut back to the last whole folder before a placeholder. */
function literalPart(token: string, restOfLine: string): string | null {
  let path = token.replace(/[.,;:]+$/, "");
  const cut = PLACEHOLDER.exec(path);
  if (cut || PLACEHOLDER.test(restOfLine.slice(0, 1))) {
    path = cut ? path.slice(0, cut.index) : path;
    path = path.slice(0, path.lastIndexOf("/") + 1);
  }
  return path.replace(/^[./]+|[./]+$/g, "") === "context" ? null : path;
}

export const refs: Check = {
  id: "refs",
  // A module, not always on: a repo whose docs describe other repos' .context/ (a tool, a portfolio) does not use it.
  module: "refs",
  description: "every .context/ path a tracked or local .context/ file names exists; a [[link]] names a page (a link to a page not yet written is a note)",
  run({ repo, config }) {
    const listed = git(repo, ["ls-files", "-z"]);
    if (listed.status !== 0) return [];
    // A .context/ listed in .gitignore (kept local because it cannot be pushed) is still the repo's knowledge.
    const localOnly = git(repo, ["check-ignore", "-q", ".context/"]).status === 0;
    const tracked = listed.stdout.split("\0").filter(Boolean);
    const files = [...new Set([...tracked, ...(localOnly ? onDisk(repo) : [])])].filter((file) => !BINARY.test(file));
    // A copy of the source repo's file carries the source's paths; the product cannot edit it.
    const copied = new Set(usedCopies(config).map((pair) => pair.to));
    const pages = new Set(files.filter((f) => f.startsWith(".context/wiki/") && f.endsWith(".md")).map((f) => basename(f, ".md")));
    const features = new Set(files.flatMap((f) => (FEATURE_FILE.exec(f) ? [`FEAT-${FEATURE_FILE.exec(f)![1]}`] : [])));
    const resolves = (target: string) => pages.has(target) || features.has(target) || existsSync(join(repo, ".context", `${target}.md`));
    const exists = new Map<string, boolean>();
    const present = (path: string) => {
      if (!exists.has(path)) {
        // An ignored path is build output that may not exist yet, unless all of .context/ is ignored.
        const ignored = !localOnly && git(repo, ["check-ignore", "-q", path]).status === 0;
        exists.set(path, existsSync(join(repo, path)) || ignored);
      }
      return exists.get(path)!;
    };

    const findings: Finding[] = [];
    for (const file of files) {
      if (copied.has(file)) continue;
      let text: string;
      try {
        text = readFileSync(join(repo, file), "utf8");
      } catch {
        continue; // deleted in the working tree, or a submodule
      }
      const dated = DATED.test(file);
      const links = file.startsWith(".context/") && file.endsWith(".md");
      text.split("\n").forEach((line, index) => {
        const at = `${file}:${index + 1}`;
        const inConfig = file === CONFIG_FILE;
        const future = inConfig && STAGE_DONE.test(line);
        const own = inConfig ? line.replace(COPY_TO, "") : line;
        if (!dated && !future && own.includes(".context/") && !FROM_HISTORY.test(own)) {
          for (const match of own.matchAll(PATH)) {
            let path = literalPart(match[2], own.slice(match.index! + match[0].length));
            if (path === null) continue;
            if (match[1]) path = normalize(join(dirname(file), path)) + (path.endsWith("/") ? "/" : "");
            if (!present(path)) findings.push({ check: "refs", level: "error", file: at, message: `${path} does not exist` });
          }
        }
        if (links && line.includes("[[")) {
          for (const match of line.matchAll(LINK)) {
            const target = match[1].trim();
            if (!resolves(target)) findings.push({ check: "refs", level: "warn", file: at, message: `[[${target}]] names no page yet` });
          }
        }
      });
    }
    return findings;
  },
};
