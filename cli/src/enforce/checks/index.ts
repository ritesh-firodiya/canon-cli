import { architecture } from "./architecture.ts";
import { canonicalValues } from "./canonical-values.ts";
import { contextLayout } from "./context-layout.ts";
import { contextSize } from "./context-size.ts";
import { staleCopies } from "./stale-copies.ts";
import { standardsCopies } from "./standards-copies.ts";
import { commandChecks } from "./commands.ts";
import { designs, designsFirst } from "./designs.ts";
import { diagrams } from "./diagrams.ts";
import { drift } from "./drift.ts";
import { listing } from "./listing.ts";
import { locks } from "./locks.ts";
import { metricsDefinitions } from "./metrics-definitions.ts";
import { oneHome } from "./one-home.ts";
import { pipeline } from "./pipeline.ts";
import { records } from "./records.ts";
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
  records,
  listing,
  canonicalValues,
  oneHome,
  drift,
  standardsCopies,
  sharedFiles,
  refs,
  staleCopies,
  architecture,
  metricsDefinitions,
  sources,
  pipeline,
  locks,
  designsFirst,
  designs,
  diagrams,
  commandChecks,
];
