import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Config, StageSpec } from "../config/schema.ts";
import { allRecords, approvalsOf, findRecord, setFields, type Approval } from "../records/records.ts";

export interface StageState {
  id: string;
  gate: boolean;
  /** The first `done` path that exists, or null when the stage has not started. */
  startedAt: string | null;
  /** Whether any record has this gate approved; null for a stage with no gate. */
  approved: boolean | null;
}

/** The stages of one pipeline, in order, with where each stands across the repo's records. */
export function stagesOf(repo: string, config: Config, name = "default"): StageState[] {
  const approved = new Set(allRecords(repo, config).flatMap((record) => approvalsOf(record.data).map((approval) => approval.stage)));
  return pipelineOf(config, name).map((stage) => ({
    id: stage.id,
    gate: stage.gate,
    startedAt: stage.done.find((path) => existsSync(join(repo, path))) ?? null,
    approved: stage.gate ? approved.has(stage.id) : null,
  }));
}

export function pipelineOf(config: Config, name: string): StageSpec[] {
  const stages = config.pipelines[name];
  if (!stages) throw new Error(`no pipeline "${name}" — pipelines here: ${Object.keys(config.pipelines).join(", ")}`);
  return stages;
}

/** Records a person's approval on the record. Stages a person does are approved the same way as gates. */
export function approveStage(repo: string, config: Config, recordId: string, stageId: string, by: string, note: string, now = new Date()): Approval {
  const record = findRecord(repo, config, recordId);
  const stages = pipelineOf(config, String(record.data.pipeline ?? "default"));
  const needing = stages.filter((stage) => stage.gate || stage.by === "person").map((stage) => stage.id);
  if (!needing.includes(stageId)) throw new Error(`"${stageId}" needs no approval here — stages that do: ${needing.join(", ") || "none"}`);
  const approval: Approval = { stage: stageId, by, at: now.toISOString(), ...(note ? { note } : {}) };
  setFields(repo, record.file, { approvals: [...approvalsOf(record.data), approval] });
  return approval;
}
