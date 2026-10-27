import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "./types.ts";

const DEFINITIONS = ".context/metrics/definitions.yml";

export const metricsDefinitions: Check = {
  id: "metrics-definitions",
  module: "metrics",
  description: "metrics/definitions.yml names the numbers the weigh gate measures value against",
  run({ repo }) {
    if (existsSync(join(repo, DEFINITIONS))) return [];
    // A warning: most products turn metrics on before they define a single number.
    return [{ check: "metrics-definitions", level: "warn", file: DEFINITIONS, message: "no metric definitions — the weigh gate cannot name the metric a request moves" }];
  },
};
