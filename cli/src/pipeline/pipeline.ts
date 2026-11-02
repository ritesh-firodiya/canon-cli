import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Config, StageSpec } from "../config/schema.ts";
import { allRecords, approvalsOf, findRecord, setFields, type Approval, type WorkRecord } from "../records/records.ts";

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

/** Enough different allowed people have approved this stage on this record. */
export function isApproved(stage: StageSpec, data: Record<string, unknown>): boolean {
  const people = approvalsOf(data).filter((approval) => approval.stage === stage.id && (!stage.approvers || stage.approvers.includes(approval.by)));
  return new Set(people.map((approval) => approval.by)).size >= (stage.required ?? 1);
}

function stageOf(config: Config, record: WorkRecord, stageId: string): StageSpec {
  const stages = pipelineOf(config, String(record.data.pipeline ?? "default"));
  const needing = stages.filter((stage) => stage.gate || stage.by === "person");
  const stage = needing.find((entry) => entry.id === stageId);
  if (!stage) throw new Error(`"${stageId}" needs no approval here — stages that do: ${needing.map((entry) => entry.id).join(", ") || "none"}`);
  return stage;
}

/** Records a person's approval on the record. Stages a person does are approved the same way as gates. */
export function approveStage(repo: string, config: Config, recordId: string, stageId: string, by: string, note: string, now = new Date()): Approval {
  const record = findRecord(repo, config, recordId);
  const stage = stageOf(config, record, stageId);
  if (stage.approvers && !stage.approvers.includes(by)) throw new Error(`${by} cannot approve ${stageId} — approvers: ${stage.approvers.join(", ")}`);
  if (approvalsOf(record.data).some((approval) => approval.stage === stageId && approval.by === by)) throw new Error(`${by} already approved ${stageId} on ${recordId}`);
  const approval: Approval = { stage: stageId, by, at: now.toISOString(), ...(note ? { note } : {}) };
  setFields(repo, record.file, { approvals: [...approvalsOf(record.data), approval] });
  return approval;
}

/** Sends a stage back, gated or not: it and every stage after it lose their approvals and run again, and the next run is told why. */
export function rejectStage(repo: string, config: Config, recordId: string, stageId: string, by: string, note: string, now = new Date()): void {
  const record = findRecord(repo, config, recordId);
  const stages = pipelineOf(config, String(record.data.pipeline ?? "default"));
  const from = stages.findIndex((stage) => stage.id === stageId);
  if (from < 0) throw new Error(`no stage "${stageId}" here: ${stages.map((stage) => stage.id).join(", ")}`);
  const redone = new Set(stages.slice(from).map((stage) => stage.id));
  setFields(repo, record.file, {
    approvals: approvalsOf(record.data).filter((approval) => !redone.has(approval.stage)),
    completed: ((record.data.completed ?? []) as string[]).filter((id) => !redone.has(id)),
    rejections: [...((record.data.rejections ?? []) as object[]), { stage: stageId, by, at: now.toISOString(), note }],
  });
}
