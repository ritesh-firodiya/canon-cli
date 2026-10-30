import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { kindCovers } from "../config/schema.ts";
import { checkSurface } from "./design-set/index.ts";
import type { Check, Finding } from "./types.ts";

const DESIGNS = ".context/designs";
const MAX_OUTPUT_LINES = 15;

/**
 * Every drawn surface: in a Babul set (design.js beside the sizes), each size folder with its journey (index.html).
 */
export function designSurfaces(repo: string): string[] {
  const root = join(repo, DESIGNS);
  if (!existsSync(root)) return [];
  if (!existsSync(join(root, "design.js"))) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "index.html")))
    .map((entry) => `${DESIGNS}/${entry.name}`)
    .sort();
}

/** A Babul set holds none of its shell: `canon ui` serves shell.js and the shell itself, both from canon. */
function shellFindings(repo: string): Finding[] {
  const root = join(repo, DESIGNS);
  if (!existsSync(join(root, "design.js"))) return [];
  return ["_shell", "shell.js"]
    .filter((name) => existsSync(join(root, name)))
    .map((name) => ({ check: "designs", level: "error", file: `${DESIGNS}/${name}`, message: "the shell lives in canon — delete this copy; `canon ui` serves it" }));
}

/** Runs the design-set checks (./design-set) once per drawn surface. */
export const designs: Check = {
  id: "designs",
  module: "design",
  description: "every drawn surface follows the design-sets standard",
  run({ repo, canonRoot }) {
    return shellFindings(repo).concat(designSurfaces(repo).flatMap((surface): Finding[] => {
      let result;
      try {
        result = checkSurface(repo, surface, join(canonRoot, "shell"));
      } catch (error) {
        return [{ check: "designs", level: "error", file: surface, message: `the design checks crashed: ${(error as Error).message}` }];
      }
      if (result.fail === 0) return [];
      const output = result.output.trim().split("\n").slice(-MAX_OUTPUT_LINES).join("\n");
      return [{ check: "designs", level: "error", file: surface, message: output }];
    }));
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
