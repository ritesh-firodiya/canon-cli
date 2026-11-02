import { BUILT_IN_TRIGGER_SOURCES } from "../config/schema.ts";
import { isApproved } from "../pipeline/pipeline.ts";
import { allRecords } from "../records/records.ts";
import type { Check, Finding } from "./types.ts";

export const pipeline: Check = {
  id: "pipeline",
  module: null,
  description: "no record passes a gate without a person's approval; every trigger names a real source and pipeline",
  run({ repo, config }) {
    const file = ".context/context.yaml";
    const finding = (message: string, where = file): Finding => ({ check: "pipeline", level: "error", file: where, message });
    const sources = [...BUILT_IN_TRIGGER_SOURCES, ...config.connectors.map((entry) => entry.id)];
    const triggers = config.triggers.flatMap((entry) => [
      ...(sources.includes(entry.source) ? [] : [finding(`trigger "${entry.id}" reads from ${entry.source}, which is not a connector or one of ${BUILT_IN_TRIGGER_SOURCES.join(", ")}`)]),
      ...(entry.pipeline && !config.pipelines[entry.pipeline] ? [finding(`trigger "${entry.id}" uses pipeline ${entry.pipeline}, which does not exist`)] : []),
    ]);
    const gates = allRecords(repo, config).flatMap((record) => {
      const name = String(record.data.pipeline ?? "default");
      const stages = config.pipelines[name];
      if (record.data.pipeline && !stages) return [finding(`follows pipeline ${name}, which does not exist`, record.file)];
      const current = stages?.findIndex((stage) => stage.id === record.data.stage) ?? -1;
      if (current < 0) return [];
      const skipped = new Set(((record.data.skipped ?? []) as { stage: string }[]).map((entry) => entry.stage));
      return stages
        .slice(0, current)
        .filter((stage) => stage.gate && !isApproved(stage, record.data) && !skipped.has(stage.id))
        .map((stage) => finding(`reached "${record.data.stage}" before gate "${stage.id}" was approved — a person runs \`canon approve ${stage.id} --record ${record.id}\``, record.file));
    });
    return [...triggers, ...gates];
  },
};
