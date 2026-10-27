import { architecture } from "./architecture.ts";
import { canonicalValues } from "./canonical-values.ts";
import { contextLayout } from "./context-layout.ts";
import { contextSize } from "./context-size.ts";
import { staleCopies } from "./stale-copies.ts";
import { standardsCopies } from "./standards-copies.ts";
import { commandChecks } from "./commands.ts";
import { designs } from "./designs.ts";
import { features } from "./features.ts";
import { listing } from "./listing.ts";
import { metricsDefinitions } from "./metrics-definitions.ts";
import { pipeline } from "./pipeline.ts";
import { refs } from "./refs.ts";
import { sharedFiles } from "./shared-files.ts";
import { sources } from "./sources.ts";
import { tasks } from "./tasks.ts";
import type { Check } from "./types.ts";
import { wikiFrontmatter } from "./wiki-frontmatter.ts";

export const ALL_CHECKS: Check[] = [
  contextLayout,
  wikiFrontmatter,
  contextSize,
  tasks,
  features,
  listing,
  canonicalValues,
  standardsCopies,
  sharedFiles,
  refs,
  staleCopies,
  architecture,
  metricsDefinitions,
  sources,
  pipeline,
  designs,
  commandChecks,
];
