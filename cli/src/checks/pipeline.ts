import { existsSync } from "node:fs";
import { join } from "node:path";
import { BUILT_IN_TRIGGER_SOURCES } from "../config/schema.ts";
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
  description: "no stage starts before every earlier gate is approved; every trigger reads from a connector or a built-in source",
  run({ repo, config }) {
    const approved = new Set(readApprovals(repo).map((approval) => approval.stage));
    const startedAt = config.pipeline.map((stage) => stage.done.find((path) => existsSync(join(repo, path))));
    const sources = [...BUILT_IN_TRIGGER_SOURCES, ...config.connectors.map((entry) => entry.id)];
    const badTriggers = config.triggers
      .filter((entry) => !sources.includes(entry.source))
      .map((entry): Finding => ({ check: "pipeline", level: "error", file: ".context/context.yaml", message: `trigger "${entry.id}" reads from ${entry.source}, which is not a connector or one of ${BUILT_IN_TRIGGER_SOURCES.join(", ")}` }));
    const gates = config.pipeline.flatMap((gate, index): Finding[] => {
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
    return [...badTriggers, ...gates];
  },
};
