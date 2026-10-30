import { appFlow, routes } from "./app.ts";
import { copy } from "./copy.ts";
import { acyclic, babul, clickThrough, inventory, links, tokens, wellFormed } from "./drawing.ts";
import { loadSurface } from "./set.ts";

export interface SurfaceResult {
  fail: number;
  output: string;
}

/**
 * The checks from the design-sets standard over one surface of a Babul set. There is no lint and no build for a
 * design set, so these are it: the set against itself (inventory, markup, links, tokens, chart), the set against
 * the app that renders it (routes, navigation both ways, dialog copy), and the Babul data against itself.
 */
export function checkSurface(repo: string, surface: string, shell: string): SurfaceResult {
  const s = loadSurface(repo, surface, shell);
  for (const check of [inventory, wellFormed, links, tokens, clickThrough, acyclic, routes, appFlow, copy, babul]) check(s);
  const { report } = s;
  report.say("");
  report.say(report.fail ? `${report.fail} FAILURES` : "ALL CHECKS PASS");
  return { fail: report.fail, output: report.lines.join("\n") };
}
