import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { kindCovers } from "../config/schema.ts";
import type { Check, Finding } from "./types.ts";

const DESIGNS = ".context/designs";
const MAX_OUTPUT_LINES = 15;

/**
 * Every drawn surface: a folder under .context/designs/ with a routes.js manifest, or, in a Babul
 * set (babul.js beside the sizes), each size folder with its journey (index.html).
 */
export function designSurfaces(repo: string): string[] {
  const root = join(repo, DESIGNS);
  if (!existsSync(root)) return [];
  const babul = existsSync(join(root, "babul.js"));
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, babul ? "index.html" : "routes.js")))
    .map((entry) => `${DESIGNS}/${entry.name}`)
    .sort();
}

/** Runs canon's design-set checker (scripts/check-designs.py) once per drawn surface. */
export const designs: Check = {
  id: "designs",
  module: "design",
  description: "every drawn surface follows the design-sets standard (scripts/check-designs.py)",
  run({ repo, canonRoot }) {
    const script = join(canonRoot, "scripts", "check-designs.py");
    return designSurfaces(repo).flatMap((surface): Finding[] => {
      const result = spawnSync("python3", [script, surface], { cwd: repo, encoding: "utf8" });
      if (result.error) return [{ check: "designs", level: "error", file: surface, message: `could not run python3: ${result.error.message}` }];
      if (result.status === 0) return [];
      const output = `${result.stdout}\n${result.stderr}`.trim().split("\n").slice(-MAX_OUTPUT_LINES).join("\n");
      return [{ check: "designs", level: "error", file: surface, message: output }];
    });
  },
};

/** A repo that follows design-sets draws its screens first (pipeline stage 1): a mobile or web repo keeps .context/designs/. */
export const designsFirst: Check = {
  id: "designs-first",
  module: null,
  description: "a mobile or web repo on the design-sets standard draws its screens in .context/designs/ before any code",
  run({ repo, config }) {
    // A repo that designs outside the repo (Figma, a design team) keeps no HTML sets.
    if (!config.standards.includes("design-sets")) return [];
    const hasScreens = kindCovers(config.kind, "mobile") || kindCovers(config.kind, "web");
    if (!hasScreens || existsSync(join(repo, DESIGNS))) return [];
    return [{ check: "designs-first", level: "error", file: DESIGNS, message: "no .context/designs yet — stage 1 (HTML designs) comes before any code" }];
  },
};
