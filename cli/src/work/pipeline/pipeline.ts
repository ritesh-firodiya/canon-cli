import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Config, StageSpec } from "../../config/schema.ts";
import { allRecords, approvalsOf, findRecord, setFields, type Approval, type WorkRecord } from "../records/records.ts";
import { afterOf, stagesAfter } from "./graph.ts";

export interface StageState {
  id: string;
  /** The stages it may follow. */
  after: string[];
  gate: boolean;
  /** The first `done` path that exists, or null when the stage has not started. */
  startedAt: string | null;
  /** Whether any record has this gate approved; null for a stage with no gate. */
  approved: boolean | null;
}

/** The stages of one pipeline, in order, with where each stands across the repo's records. */
export function stagesOf(repo: string, config: Config, name = "default"): StageState[] {
  const approved = new Set(allRecords(repo, config).flatMap((record) => approvalsOf(record.data).map((approval) => approval.stage)));
  const stages = pipelineOf(config, name);
  return stages.map((stage) => ({
    id: stage.id,
    after: afterOf(stages, stage),
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

/** The stage whose work is the record's own page: the one named for its kind, else the first whose done holds its folder. */
export function stageOfKind(stages: StageSpec[], record: WorkRecord): StageSpec | undefined {
  // The name comes first: a repo may point a stage's done at another kind's folder.
  return stages.find((stage) => stage.id === record.kind.folder.replace(/s$/, "")) ?? stages.find((stage) => stage.done.includes(join(".context", record.kind.folder)));
}

/** Where a record's work begins: where it was started, else its own kind's stage, else the first stage. */
export function startOf(stages: StageSpec[], record: WorkRecord): string | undefined {
  const started = stages.find((stage) => stage.id === record.data["started-at"]);
  return (started ?? stageOfKind(stages, record) ?? stages[0])?.id;
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

/** Sends a stage back, gated or not: it and every stage it leads to lose their approvals and run again, and the next run is told why. */
export function rejectStage(repo: string, config: Config, recordId: string, stageId: string, by: string, note: string, now = new Date()): void {
  const record = findRecord(repo, config, recordId);
  const stages = pipelineOf(config, String(record.data.pipeline ?? "default"));
  if (!stages.some((stage) => stage.id === stageId)) throw new Error(`no stage "${stageId}" here: ${stages.map((stage) => stage.id).join(", ")}`);
  const redone = new Set([stageId, ...stagesAfter(stages, stageId)]);
  setFields(repo, record.file, {
    approvals: approvalsOf(record.data).filter((approval) => !redone.has(approval.stage)),
    completed: ((record.data.completed ?? []) as string[]).filter((id) => !redone.has(id)),
    rejections: [...((record.data.rejections ?? []) as object[]), { stage: stageId, by, at: now.toISOString(), note }],
  });
}

/** Where a person left a record (`at`), or the stage a run reached, or else where its kind of record starts. */
export function stageOfRecord(config: Config, record: WorkRecord): string | null {
  const stages = pipelineOf(config, String(record.data.pipeline ?? "default"));
  const saved = stages.find((stage) => stage.id === (record.data.at ?? record.data.stage));
  return (saved ?? stageOfKind(stages, record))?.id ?? null;
}
