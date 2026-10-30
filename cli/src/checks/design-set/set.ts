import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { basename, join, normalize, posix } from "node:path";
import { isDir, read, sorted, walk } from "./text.ts";

export interface Screen {
  file: string;
  route: string | null;
  screen: string;
}
export interface Edge {
  from: string;
  to: string;
  label?: string;
  back?: boolean;
  side?: boolean;
  state?: boolean;
}
export interface Missing {
  what?: string;
  why?: string;
}
interface Asset {
  file: string;
}
interface Scan {
  pages?: { id: string; name: string; route?: string | null }[];
  links?: { from: string; to: string; label?: string; back?: boolean; side?: boolean; tap?: boolean }[];
  journeys?: { start?: string };
  components?: { components?: { id: string; name: string }[] };
  assets?: { logos?: Asset[]; images?: Asset[]; icons?: { names?: string[] } };
  errors?: string[];
}
type Tokens = Record<string, unknown>;

/** The report a surface prints: a heading per check, a FAIL line per problem. */
export class Report {
  readonly lines: string[] = [];
  fail = 0;
  head(title: string): void {
    this.lines.push("", `== ${title}`);
  }
  say(line: string): void {
    this.lines.push(line);
  }
  bad(message: string): void {
    this.fail += 1;
    this.lines.push(`   FAIL ${message}`);
  }
}

/** One surface of a Babul set, read the way its shell reads it, with what every check needs. */
export interface Surface {
  dir: string;
  root: string;
  shell: string;
  web: boolean;
  srcDir: string;
  appDir: string;
  product: Record<string, unknown>;
  /** Every page's file in declaration order; a file holds every state of its page, so it repeats. */
  screens: string[];
  files: Map<string, Screen>;
  declared: Set<string>;
  onDisk: Set<string>;
  edges: Edge[];
  missing: Missing[];
  defs: string[];
  linkAttrs: string[];
  scan: Scan;
  tokens: Tokens;
  report: Report;
}

const DATA_FILE = /^\(window\.BABUL \|\|= \{\}\)\.(\w+) = ([\s\S]*);\s*$/;

/** One data file, as Babul reads it: the fixed prefix, then strict JSON. */
function babulData(dir: string, name: string, report: Report): Record<string, unknown> | null {
  const path = join(dir, "..", `${name}.js`);
  if (!existsSync(path)) return null;
  const key = name === "babul" ? "product" : name;
  const match = DATA_FILE.exec(read(path));
  if (!match || match[1] !== key) {
    report.bad(`${name}.js is not \`(window.BABUL ||= {}).${key} = <JSON>;\``);
    return null;
  }
  try {
    return JSON.parse(match[2]);
  } catch (error) {
    report.bad(`${name}.js does not parse as strict JSON: ${(error as Error).message}`);
    return null;
  }
}

/** The set as its shell reads it: described from the HTML by canon's shell/scan.mjs. */
function scanned(dir: string, shell: string, report: Report): Scan {
  const result = spawnSync(process.execPath, [join(shell, "scan.mjs"), "..", basename(dir), "--json"], { cwd: dir, encoding: "utf8" });
  if (result.status !== 0) {
    report.bad(`scan.mjs failed: ${(result.stderr ?? result.error?.message ?? "").trim().slice(0, 300)}`);
    return {};
  }
  return JSON.parse(result.stdout);
}

// A monorepo keeps its Expo app in apps/mobile/, a single-package app at the root; the site is Next.js and only ever lives in a monorepo.
function sourceDir(root: string, web: boolean): string {
  const candidates = web ? ["apps/website/src", "apps/web/src"] : ["apps/mobile/src", "src"];
  return candidates.map((c) => join(root, c)).find((d) => isDir(join(d, "app"))) ?? join(root, candidates[candidates.length - 1]);
}

export function loadSurface(repo: string, surface: string, shell: string): Surface {
  const dir = join(repo, surface);
  const name = basename(normalize(dir));
  const root = normalize(join(dir, "..", "..", ".."));
  const web = name === "web";
  const srcDir = sourceDir(root, web);
  // An email renders no app route, so the routes, app-flow and copy checks have nothing to read.
  const appDir = name === "email" ? join(root, ".no-app") : join(srcDir, "app");
  const report = new Report();

  const scan = scanned(dir, shell, report);
  const product = babulData(dir, "babul", report) ?? {};
  // One file holds every state of a page, so a frame's file is its page's.
  const html = (frame: string) => `${frame.split(".")[0]}.html`;
  const pages: Screen[] = (scan.pages ?? []).map((p) => ({ file: html(p.id), route: p.route ?? null, screen: p.name }));
  const components: Screen[] = (scan.components?.components ?? []).map((c) => ({ file: `components/${c.id}.html`, route: null, screen: c.name }));
  const all = [...pages, ...components];
  // Between files only: a link to another state of the same page is checked frame by frame by scan.mjs.
  const edges: Edge[] = (scan.links ?? []).flatMap((l) => {
    const edge: Edge = { from: html(l.from), to: html(l.to) };
    if (edge.from === edge.to) return [];
    for (const key of ["label", "back", "side"] as const) if (key in l) Object.assign(edge, { [key]: l[key] });
    if (l.tap === false) edge.state = true;
    return [edge];
  });

  const defs = existsSync(join(dir, "components")) ? readdirSync(join(dir, "components")).filter((f) => f.endsWith(".js")).sort().map((f) => `components/${f}`) : [];
  // A property a definition puts in an href — top-bar's `back` — is a link where an instance sets it, exactly as an href is.
  const linkAttrs = ["href", ...sorted(defs.flatMap((d) => [...read(join(dir, d)).matchAll(/href="\{([a-z][a-z0-9-]*)\}"/g)].map((m) => m[1])))];

  return {
    dir, root, shell, web, srcDir, appDir, product, edges, defs, linkAttrs, scan, report,
    screens: all.map((s) => s.file),
    files: new Map(all.map((s) => [s.file, s])),
    declared: new Set(all.map((s) => s.file)),
    // The shell's own style pages are drawn from the data, never declared in it.
    onDisk: new Set(walk(dir).filter((f) => f.includes("/") && f.endsWith(".html") && !f.startsWith("styles/"))),
    missing: (product.missing as Missing[] | undefined) ?? [],
    tokens: babulData(dir, "tokens", report) ?? {},
  };
}

/** Every local link in a drawn file, as [raw href, target relative to the surface]. */
export function hrefs(s: Surface, file: string): [string, string][] {
  const text = read(join(s.dir, file));
  const attr = new RegExp(`\\b(?:${s.linkAttrs.join("|")})="([^"]+)"`, "g");
  return [...text.matchAll(attr)].flatMap((m): [string, string][] => {
    const raw = m[1];
    // tel: and sms: leave the set the same way mailto: does.
    if (/^(http|#|mailto:|tel:|sms:)/.test(raw)) return [];
    return [[raw, posix.normalize(posix.join(posix.dirname(file), raw.split("?")[0].split("#")[0]))]];
  });
}

export const shellPages = (s: Surface): string[] => ["index.html", "styles.html", "screenshots.html"].filter((p) => existsSync(join(s.dir, p)));
