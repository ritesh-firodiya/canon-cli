import { readdirSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { isDir, isFile, read, sorted, walk } from "./text.ts";
import type { Surface } from "./set.ts";

// The checks that compare the set with the app that renders it: routes, then navigation both ways.

/** expo-router makes every .tsx under app/ a screen except a layout; the Next.js app router makes a screen of page.tsx only. */
const isScreen = (s: Surface, name: string) => (s.web ? name === "page.tsx" : name.endsWith(".tsx") && name !== "_layout.tsx");

/** What `missing` says, as one string a route or a file name is looked up in. */
const recorded = (s: Surface) => s.missing.map((m) => `${m.what ?? ""} ${m.why ?? ""}`).join(" ");

export function routes(s: Surface): void {
  s.report.head("routes — every app screen is drawn, and every drawing has a screen");
  if (!isDir(s.appDir)) {
    s.report.say(`   skipped — no app at ${s.appDir}`);
    return;
  }
  const onDisk = new Set(walkAll(s.appDir).filter((f) => isScreen(s, basename(f))));
  const declared = new Set(sorted(s.declared).flatMap((f) => s.files.get(f)?.route ?? []));
  for (const r of sorted([...declared].filter((r) => !onDisk.has(r)))) s.report.bad(`routes.js points at src/app/${r}, which does not exist`);
  // A route that ships with no drawing is allowed ONLY while `missing` says why.
  const said = recorded(s);
  for (const r of sorted([...onDisk].filter((r) => !declared.has(r)))) {
    if (said.includes(r)) s.report.say(`   pending: src/app/${r} ships and is recorded in \`missing\``);
    else s.report.bad(`src/app/${r} ships and no screen draws it, and \`missing\` does not say why`);
  }
  const drawn = [...s.declared].filter((f) => s.files.get(f)?.route).length;
  s.report.say(`   ${onDisk.size} app screens, all drawn by ${drawn} wireframes`);
}

/** Every file under dir, dot folders included, as os.walk sees them. */
function walkAll(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[]).filter((f) => isFile(join(dir, f))).sort();
}

/**
 * A route and a filename, reduced to the same thing: no extension, no leading slash, no query, no route group,
 * any dynamic segment as `[]`, and an index (page on the web) as its folder.
 */
export function appRoute(s: Surface, href: string): string {
  let h = href.split("?")[0].replace(/^\/+|\/+$/g, "");
  h = `${h}/`.replace(/\([^)/]+\)\//g, "").replace(/\/+$/, "");
  h = h.replace(/\.tsx$/, "").replace(/\[[^\]/]*\]/g, "[]");
  return h.replace(s.web ? /(^|\/)(?:index|page)$/ : /(^|\/)index$/, "");
}

// A route literal, in whichever quote the app writes them.
const ROUTE_LIT = String.raw`(?:["'](\/[^"'` + "`" + String.raw`$]*)|` + "`" + String.raw`(\/[^` + "`" + String.raw`]*)` + "`)";

/** Every route literal in text, optionally only those following `before`; an interpolation is a dynamic segment. */
function routeLiterals(text: string, before = ""): Set<string> {
  return new Set([...text.matchAll(new RegExp(before + ROUTE_LIT, "g"))].map((m) => m[1] ?? m[2].replace(/\$\{[^}]*\}/g, "[]")));
}

export function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Drop the redirects that recover from a state that should not happen: `if (!plate) router.replace(...)` is not a route a user takes. */
function stripGuards(text: string): string {
  return text.replace(/if\s*\(\s*\(?\s*![^;{]*?\)\s*\{?[^;}]*?router\.replace\([^;]*?\);/g, "");
}

/** The text up to the paren that closes the one just before `from`. */
function balanced(text: string, from: number): string {
  let i = from;
  let depth = 1;
  while (i < text.length && depth) {
    depth += Number(text[i] === "(") - Number(text[i] === ")");
    i += 1;
  }
  return text.slice(from, i);
}

/** Every app route this source navigates to: any "/..." string in a router call, a <Redirect>, a link-like prop, or a const such a prop names. */
export function routesIn(s: Surface, text: string): Set<string> {
  const out = new Set<string>();
  const add = (found: Set<string>) => found.forEach((r) => out.add(r));
  const call = s.web ? /(?:router\.(?:push|replace)|\bredirect)\(/g : /router\.(?:push|replace)\(/g;
  for (const m of text.matchAll(call)) add(routeLiterals(balanced(text, (m.index as number) + m[0].length)));
  for (const m of text.matchAll(/<Redirect\b[^>]*>/g)) add(routeLiterals(m[0]));
  add(routeLiterals(text, String.raw`\b(?:href|path|to)=\{?\s*`));
  for (const name of new Set([...text.matchAll(/\b(?:href|path|to)=\{\s*([A-Za-z_]\w*)\s*\}/g)].map((m) => m[1]))) {
    for (const m of text.matchAll(new RegExp(String.raw`\bconst\s+${name}\s*=([\s\S]*?);`, "g"))) add(routeLiterals(m[1]));
  }
  return out;
}

const importsOf = (text: string, prefix: string) => [...text.matchAll(new RegExp(String.raw`from\s+["']@/(${prefix}[^"']+)["']`, "g"))].map((m) => m[1]);

/** How many files import each hook. One means the hook belongs to that file. */
function hookUsers(s: Surface): Map<string, number> {
  const users = new Map<string, number>();
  if (s.web) return users;
  for (const f of walk(s.srcDir).filter((f) => /\.ts[^/]*$/.test(basename(f)))) {
    for (const hook of new Set(importsOf(read(join(s.srcDir, f)), "hooks/"))) users.set(hook, (users.get(hook) ?? 0) + 1);
  }
  return users;
}

/**
 * The source that renders one screen. In Expo: the route file, the components it mounts, and inside that
 * component's feature folder its sections and the hooks only it uses. On the web: the page's folder, stopping
 * at any folder that is a page of its own.
 */
function screenSource(s: Surface, path: string, hooks: Map<string, number>): string {
  if (!s.web) {
    const resolve = (spec: string) => [".tsx", ".ts"].map((e) => join(s.srcDir, spec + e)).find(isFile);
    const text = read(path);
    const seen: string[] = [];
    for (const spec of importsOf(text, "components/")) {
      const hit = resolve(spec);
      if (!hit || seen.includes(hit)) continue;
      seen.push(hit);
      const inner = read(hit);
      const own = importsOf(inner, "hooks/").filter((h) => hooks.get(h) === 1);
      for (const more of [...own, ...importsOf(inner, `${dirname(spec)}/`)]) {
        const deep = resolve(more);
        if (deep && !seen.includes(deep)) seen.push(deep);
      }
    }
    return [text, ...seen.map(read)].join("\n");
  }
  const parts: string[] = [];
  const visit = (dir: string, top: boolean) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    if (!top && entries.some((e) => e.isFile() && e.name === "page.tsx")) return;
    for (const e of entries.filter((e) => e.isFile() && /\.tsx?$/.test(e.name)).sort((a, b) => (a.name < b.name ? -1 : 1))) parts.push(read(join(dir, e.name)));
    for (const e of entries.filter((e) => e.isDirectory())) visit(join(dir, e.name), false);
  };
  visit(dirname(path), true);
  return parts.join("\n");
}

interface Navigation {
  owners: Map<string, string[]>;
  hooks: Map<string, number>;
  screens: [string, string][];
}

function navigation(s: Surface): Navigation {
  // Declaration order: the first owner of a route is what a message names.
  const owners = new Map<string, string[]>();
  for (const f of s.screens) {
    const r = s.files.get(f)?.route;
    if (r) owners.set(r, [...(owners.get(r) ?? []), f]);
  }
  const screens = walk(s.appDir).filter((f) => f.endsWith(".tsx")).map((rel): [string, string] => [join(s.appDir, rel), rel]);
  return { owners, hooks: hookUsers(s), screens };
}

export function appFlow(s: Surface): void {
  s.report.head("app-flow — every navigation the app performs is a declared edge");
  const nav = navigation(s);
  const route = (r: string) => appRoute(s, r);
  let navigations = 0;
  const undeclared = new Set<string>();
  for (const [path, rel] of nav.screens) {
    const froms = nav.owners.get(rel) ?? [];
    if (!froms.length) continue;
    for (const t of sorted(routesIn(s, stripGuards(stripComments(screenSource(s, path, nav.hooks)))))) {
      const tos = [...nav.owners].filter(([r]) => route(r) === route(t)).flatMap(([, fs]) => fs);
      if (!tos.length) continue;
      navigations += 1;
      if (!s.edges.some((e) => froms.includes(e.from) && tos.includes(e.to))) undeclared.add(`${froms[0]} -> ${tos[0]}  (${rel} navigates to ${t})`);
    }
  }
  const said = recorded(s);
  for (const u of sorted(undeclared)) {
    // A deliberate departure is fine and must be STATED.
    const key = u.split("  (")[0];
    if (key.split(" -> ").every((part) => said.includes(part))) s.report.say(`   pending: ${key} — recorded in \`missing\``);
    else s.report.bad(u);
  }
  reverseFlow(s, nav, navigations);
}

/** Routes every screen can reach without naming them: shared components and hooks, and on a tab screen the tab bar. */
function sharedTargets(s: Surface, nav: Navigation): Set<string> {
  const known = new Set([...nav.owners.keys()].map((r) => `/${appRoute(s, r)}`));
  const targets = new Set<string>();
  const shared = walk(s.srcDir).filter((f) => (f.startsWith("components/") && /\.tsx?$/.test(f)) || (f.startsWith("hooks/") && f.endsWith(".ts")));
  for (const f of shared) {
    const text = stripComments(read(join(s.srcDir, f)));
    routesIn(s, text).forEach((t) => targets.add(t));
    // Any route-shaped literal: a component that names one is going there (useGo hands it to router.push).
    for (const m of text.matchAll(/["'`](\/[a-z(][^"'`$]*)/g)) if (known.has(`/${appRoute(s, m[1])}`)) targets.add(m[1]);
  }
  return targets;
}

interface Tabs {
  rel: string;
  targets: Set<string>;
}

// The tab group sits at the top of app/ in a small app and inside an auth group in a larger one, so it is found, not assumed.
function tabs(s: Surface): Tabs {
  const layout = walk(s.appDir).find((f) => /(^|\/)\(tabs\)\/_layout\.tsx$/.test(f)) ?? "(tabs)/_layout.tsx";
  const dir = join(s.appDir, dirname(layout));
  const targets = isFile(join(s.appDir, layout)) ? routesIn(s, stripComments(read(join(s.appDir, layout)))) : new Set<string>();
  // Every screen directly in (tabs)/ is a tab; a tab with a stack of its own is a folder there, entered at its index.
  if (isDir(dir)) {
    for (const f of readdirSync(dir)) {
      if ((f.endsWith(".tsx") && !f.startsWith("_")) || isFile(join(dir, f, "index.tsx"))) targets.add(`/(tabs)/${f.replace(/\.[^.]*$/, "")}`);
    }
  }
  return { rel: relative(s.appDir, dir), targets };
}

// The other direction: edges the chart promises and the app never performs. Forward edges only — a back, a
// side or a state is reached by gesture, tab bar or circumstance, never by a literal route.
function reverseFlow(s: Surface, nav: Navigation, navigations: number): void {
  const route = (r: string) => appRoute(s, r);
  const shared = sharedTargets(s, nav);
  const tab = tabs(s);
  const performed = new Set<string>();
  for (const [path, rel] of nav.screens) {
    const froms = nav.owners.get(rel) ?? [];
    if (!froms.length) continue;
    const reach = new Set([...routesIn(s, stripComments(screenSource(s, path, nav.hooks))), ...shared]);
    // THE TAB BAR IS ON EVERY TAB SCREEN, and it navigates by route name, so no "/..." string finds it.
    if (rel.startsWith(`${tab.rel}/`)) tab.targets.forEach((t) => reach.add(t));
    for (const f of froms) for (const t of reach) performed.add(`${f}\0${route(t)}`);
  }

  let unbuilt = 0;
  let notBuilt = 0;
  const forward = s.edges.filter((e) => !(e.back || e.side || e.state));
  for (const e of forward) {
    const from = s.files.get(e.from)?.route;
    const to = s.files.get(e.to)?.route;
    // A screen with no app yet, or two faces of one route, which change state and not route.
    if (!from || !to || route(from) === route(to)) continue;
    if (performed.has(`${e.from}\0${route(to)}`)) continue;
    unbuilt += 1;
    const key = `${e.from} -> ${e.to}`;
    // A departure is fine and must be STATED, by an entry naming this edge exactly.
    if (s.missing.some((m) => m.what === key)) {
      notBuilt += 1;
      s.report.say(`   pending: ${key} is drawn and the app does not go there — recorded in \`missing\``);
    } else {
      s.report.bad(`${key} is drawn and the app never navigates there${e.label ? ` (${e.label})` : ""}`);
    }
  }
  s.report.say(`   ${navigations} navigations checked, ${forward.length - unbuilt} forward edges honoured${notBuilt ? `, ${notBuilt} recorded as departures` : ""}`);
}
