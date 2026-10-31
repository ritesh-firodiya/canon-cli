import { existsSync } from "node:fs";
import { join } from "node:path";
import { readApprovals } from "../pipeline/pipeline.ts";
import type { Check, Finding } from "./types.ts";

/**
 * Stages run in the order context.yaml lists them. A stage has started once one
 * of its `done` paths exists; a gated stage must be approved before any later
 * stage starts. Each unapproved gate is reported once, at the first later
 * stage that started.
 */
export const pipeline: Check = {
  id: "pipeline",
  module: null,
  description: "no stage starts before every earlier gate is approved",
  run({ repo, config }) {
    const approved = new Set(readApprovals(repo).map((approval) => approval.stage));
    const startedAt = config.pipeline.map((stage) => stage.done.find((path) => existsSync(join(repo, path))));
    return config.pipeline.flatMap((gate, index): Finding[] => {
      if (!gate.gate || approved.has(gate.id)) return [];
      const later = config.pipeline.findIndex((_, i) => i > index && startedAt[i] !== undefined);
      if (later === -1) return [];
      const stage = config.pipeline[later];
      return [
        {
          check: "pipeline",
          level: "error",
          file: startedAt[later],
          message: `stage "${stage.id}" started before gate "${gate.id}" was approved — review ${gate.id}, then a person runs \`canon approve ${gate.id}\``,
        },
      ];
    });
  },
};
