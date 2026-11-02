import { BUILT_IN_TRIGGER_SOURCES } from "../config/schema.ts";
import { isApproved } from "../pipeline/pipeline.ts";
import { allRecords } from "../records/records.ts";
import type { Check, Finding } from "./types.ts";

const isAddress = (source: string) => /^https?:\/\//.test(source);

export const pipeline: Check = {
  id: "pipeline",
  module: null,
  description: "no record passes a stage without doing it or recording why it skipped, or passes a gate or a check without its evidence; triggers and checks name real sources",
  run({ repo, config }) {
    const file = ".context/context.yaml";
    const finding = (message: string, where = file): Finding => ({ check: "pipeline", level: "error", file: where, message });
    const connectors = config.connectors.map((entry) => entry.id);
    const sources = [...BUILT_IN_TRIGGER_SOURCES, ...connectors];
    const triggers = config.triggers.flatMap((entry) => [
      ...(sources.includes(entry.source) ? [] : [finding(`trigger "${entry.id}" reads from ${entry.source}, which is not a connector or one of ${BUILT_IN_TRIGGER_SOURCES.join(", ")}`)]),
      ...(entry.pipeline && !config.pipelines[entry.pipeline] ? [finding(`trigger "${entry.id}" uses pipeline ${entry.pipeline}, which does not exist`)] : []),
    ]);
    const verifySources = Object.values(config.pipelines).flat().flatMap((stage) =>
      (stage.verify ?? []).filter((source) => !connectors.includes(source) && !isAddress(source)).map((source) => finding(`stage "${stage.id}" verifies against ${source}, which is not a connector or an address`)),
    );
    const flows = allRecords(repo, config).flatMap((record) => {
      const name = String(record.data.pipeline ?? "default");
      const stages = config.pipelines[name];
      if (!stages) return record.data.pipeline ? [finding(`follows pipeline ${name}, which does not exist`, record.file)] : [];
      const completed = new Set((record.data.completed ?? []) as string[]);
      const skipped = new Set(((record.data.skipped ?? []) as { stage: string }[]).map((entry) => entry.stage));
      const verified = new Set((record.data.verified ?? []) as string[]);
      const current = stages.findIndex((stage) => stage.id === record.data.stage);
      const passed = current < 0 ? [] : stages.slice(0, current).filter((stage) => stage.id !== "problem");
      return [
        ...passed.filter((stage) => !completed.has(stage.id) && !skipped.has(stage.id)).map((stage) => finding(`reached "${record.data.stage}" with "${stage.id}" neither done nor skipped with a reason`, record.file)),
        ...passed.filter((stage) => stage.gate && !isApproved(stage, record.data) && !skipped.has(stage.id)).map((stage) => finding(`reached "${record.data.stage}" before gate "${stage.id}" was approved — a person runs \`canon approve ${stage.id} --record ${record.id}\``, record.file)),
        ...stages.filter((stage) => stage.verify?.length && completed.has(stage.id) && !verified.has(stage.id)).map((stage) => finding(`"${stage.id}" passed with no check against ${stage.verify?.join(", ")}: no ## Checked entry or --unverified reason`, record.file)),
      ];
    });
    return [...triggers, ...verifySources, ...flows];
  },
};
