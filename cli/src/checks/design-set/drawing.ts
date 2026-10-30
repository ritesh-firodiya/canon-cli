import { existsSync } from "node:fs";
import { join } from "node:path";
import { classes, read, sorted, unbrace } from "./text.ts";
import { hrefs, shellPages, type Surface } from "./set.ts";

// The checks that compare the set with itself: files, markup, links, tokens, the chart.

export function inventory(s: Surface): void {
  s.report.head("inventory — every file declared, every declaration on disk");
  for (const f of sorted([...s.onDisk].filter((f) => !s.declared.has(f)))) s.report.bad(`${f} is on disk and in no manifest entry`);
  for (const f of sorted([...s.declared].filter((f) => !s.onDisk.has(f)))) s.report.bad(`${f} is declared and not on disk`);
  s.report.say(`   ${s.screens.length} screens + 0 states = ${s.declared.size} files`);
}

// A browser silently repairs a stray or missing </div>, so a screen can be malformed for months and still
// LOOK right. Divs only: they are what the layout is built from.
export function wellFormed(s: Surface): void {
  s.report.head("well-formed — every <div> is closed exactly once, in order");
  const present = sorted([...s.declared].filter((f) => s.onDisk.has(f)));
  for (const f of present) {
    // Comments are stripped from the WHOLE text, keeping newlines so line numbers still point at the fault.
    const text = read(join(s.dir, f)).replace(/<!--[\s\S]*?-->/g, (m) => "\n".repeat(m.split("\n").length - 1));
    let depth = 0;
    const stray: number[] = [];
    text.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/<\/?div\b/g)) {
        depth += m[0] === "<div" ? 1 : -1;
        if (depth < 0) {
          stray.push(i + 1);
          depth = 0;
        }
      }
    });
    if (stray.length) s.report.bad(`${f}: </div> with nothing open at line ${stray.join(", ")}`);
    else if (depth) s.report.bad(`${f}: ${depth} <div> never closed`);
  }
  s.report.say(`   ${present.length} screens parse`);
}

export function links(s: Surface): void {
  s.report.head("links — every local href points at a file that exists");
  let n = 0;
  for (const f of sorted(s.declared)) {
    for (const [raw, target] of hrefs(s, f)) {
      n += 1;
      if (!existsSync(join(s.dir, target))) s.report.bad(`${f} -> ${target} (${raw})`);
    }
  }
  s.report.say(`   ${n} local hrefs resolved`);
}

/** Every W3C token under node, as its path; DEFAULT is its group's own name. */
function tokenPaths(node: unknown, path: string[] = []): string[][] {
  if (!node || typeof node !== "object") return [];
  if ("$value" in node) return [path];
  return Object.entries(node).flatMap(([k, v]) => (k.startsWith("$") ? [] : tokenPaths(v, k === "DEFAULT" ? path : [...path, k])));
}

const COLOR_UTILITY = /^(bg|text|border|ring|fill|stroke|from|to|via|decoration|shadow|outline)-/;
const COLOR_STEM = /^(brand|accent|conf|macro|ink|page|frame|surface|muted|sunken|line|success|warn|danger|info|camera)\b/;

export function tokens(s: Surface): void {
  s.report.head("tokens — every var(--x) and every component class resolves");
  // theme.js writes one variable per token, under exactly these names.
  const css = read(join(s.shell, "shell.css")) + read(join(s.dir, "styles.css"));
  const twColors = new Set(tokenPaths(s.tokens.color ?? {}).map((p) => p.join("-")));
  const vars = new Set([...twColors].map((c) => `--${c}`));
  for (const p of tokenPaths(s.tokens.typography ?? {})) for (const k of ["fs", "lh", "ls"]) vars.add(`--${k}-${p.join("-")}`);
  for (const group of ["radius", "shadow"]) for (const p of tokenPaths(s.tokens[group] ?? {})) vars.add(`--${[group, ...p].join("-")}`);
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:/g)) vars.add(m[1]);
  // Published at runtime by the shell, and by screenshots.html from the frame.
  for (const v of ["--chrome-h", "--stage-pad", "--tile-w", "--tile-h", "--tile-scale"]) vars.add(v);
  const declaredClasses = new Set([...css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]));

  const missingVars = new Set<string>();
  const missingClasses = new Set<string>();
  for (const f of [...sorted(s.declared), ...shellPages(s), ...s.defs]) {
    const text = read(join(s.dir, f));
    for (const m of unbrace(text).matchAll(/var\((--[a-z0-9-]+)/g)) if (!vars.has(m[1])) missingVars.add(`${f}\0${m[1]}`);
    for (const raw of classes(text)[0]) {
      const c = raw.split(":").pop() as string; // strip sm:/hover: prefixes
      if (COLOR_UTILITY.test(c)) {
        const stem = c.slice(c.indexOf("-") + 1).split("/")[0];
        if (COLOR_STEM.test(stem) && !twColors.has(stem)) missingClasses.add(`${f}\0${c}`);
      } else if (c.includes("--") && !declaredClasses.has(c)) {
        // `--` is the precise test for a modifier: every component modifier uses it and no Tailwind utility does.
        missingClasses.add(`${f}\0${c}`);
      }
    }
  }
  for (const key of sorted(missingVars)) s.report.bad(`${key.replace("\0", " uses ")} — declared nowhere in shared.css`);
  for (const key of sorted(missingClasses)) {
    const c = key.split("\0")[1];
    s.report.bad(`${key.replace("\0", " uses ")} — ${c.includes("--") ? "declared nowhere in shared.css" : "no such token in tailwind.config.js"}`);
  }
  s.report.say(`   ${vars.size} CSS variables and ${declaredClasses.size} classes declared`);
}

export function clickThrough(s: Surface): void {
  s.report.head("click-through — every declared edge is a real link in the screen it leaves");
  const shell = new Set(["index.html", "styles.html", "screenshots.html"]);
  const real = new Set<string>();
  for (const f of sorted(s.declared)) {
    for (const [, t] of hrefs(s, f)) {
      if (shell.has(t) || t === f) continue;
      // A link that leaves the surface, or opens a component's board, is not a link between two screens of this set.
      if (t.startsWith("..") || t.startsWith("components/") || t.startsWith("styles/")) continue;
      if (t.endsWith(".html")) real.add(`${f}\0${t}`);
    }
  }
  const declared = new Set(s.edges.filter((e) => !e.state).map((e) => `${e.from}\0${e.to}`));
  const stateEdges = new Set(s.edges.filter((e) => e.state).map((e) => `${e.from}\0${e.to}`));
  const arrow = (key: string) => key.replace("\0", " -> ");
  for (const key of sorted([...declared].filter((k) => !real.has(k)))) s.report.bad(`edge ${arrow(key)} is declared and is not a link`);
  s.report.say(`   ${declared.size} declared edges, all present as links`);
  s.report.head("flow-complete — every link between screens is a declared edge");
  for (const key of sorted([...real].filter((k) => !declared.has(k) && !stateEdges.has(k)))) s.report.bad(`link ${arrow(key)} is not a declared edge`);
  s.report.say(`   ${real.size} real links, all declared`);
}

// The chart ranks nodes by longest-path depth from the start, which only terminates on a DAG.
// state/back/side edges are dropped first, as the shell does when it builds the ranked graph.
export function acyclic(s: Surface): void {
  s.report.head("acyclic — the forward graph ranks, so it must be a DAG");
  const forward = new Map<string, Set<string>>();
  for (const e of s.edges) {
    if (e.state || e.back || e.side || e.from === e.to) continue;
    forward.set(e.from, (forward.get(e.from) ?? new Set()).add(e.to));
  }
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>();
  const cycles: string[] = [];
  const visit = (n: string, path: string[]) => {
    colour.set(n, GREY);
    path.push(n);
    for (const m of sorted(forward.get(n) ?? [])) {
      const c = colour.get(m);
      if (c === GREY) cycles.push([...path.slice(path.indexOf(m)), m].join(" -> "));
      else if (c === undefined) visit(m, path);
    }
    path.pop();
    colour.set(n, BLACK);
  };
  for (const n of sorted([...forward.keys(), ...[...forward.values()].flatMap((v) => [...v])])) if (!colour.has(n)) visit(n, []);
  for (const c of cycles) s.report.bad(`forward cycle: ${c}`);
  const edgeCount = [...forward.values()].reduce((sum, v) => sum + v.size, 0);
  s.report.say(`   ${edgeCount} forward edges over ${s.declared.size} screens, no cycles`);
}

// The data is whole, so Babul can import it as it stands, and styles.css holds nothing dead.
export function babul(s: Surface): void {
  s.report.head("babul — the set reads whole from its HTML, and styles.css holds nothing dead");
  for (const e of s.scan.errors ?? []) s.report.bad(e);
  for (const a of [...(s.scan.assets?.logos ?? []), ...(s.scan.assets?.images ?? [])]) {
    if (!existsSync(join(s.dir, "..", a.file))) s.report.bad(`assets.js: ${a.file} does not exist`);
  }
  const used = new Set<string>();
  const built = new Set<string>();
  for (const f of [...sorted([...s.declared].filter((f) => s.onDisk.has(f))), ...s.defs]) {
    const [fixed, prefixes] = classes(read(join(s.dir, f)));
    for (const c of fixed) used.add(c);
    for (const p of prefixes) built.add(p);
  }
  const styles = read(join(s.dir, "styles.css")).replace(/\/\*[\s\S]*?\*\//g, "");
  const own = new Set([...styles.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]));
  for (const c of sorted([...own].filter((c) => !used.has(c)))) {
    if ([...built].some((p) => c.startsWith(p))) continue;
    s.report.bad(`styles.css declares .${c} and nothing draws it`);
  }
  const counts = [s.scan.pages?.length ?? 0, s.scan.links?.length ?? 0, s.scan.components?.components?.length ?? 0, s.scan.assets?.icons?.names?.length ?? 0];
  s.report.say(`   ${counts[0]} pages, ${counts[1]} links, ${counts[2]} components, ${counts[3]} icons`);
}
