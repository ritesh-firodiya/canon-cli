import { canonicalValues } from "./canonical-values.ts";
import { contextLayout } from "./context-layout.ts";
import { staleCopies, standardsCopies } from "./copies.ts";
import { commandChecks } from "./external.ts";
import type { Check } from "./types.ts";
import { wikiFrontmatter } from "./wiki-frontmatter.ts";

export const ALL_CHECKS: Check[] = [
  contextLayout,
  wikiFrontmatter,
  canonicalValues,
  standardsCopies,
  staleCopies,
  commandChecks,
];
