import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import type { Config, StageSpec } from "../config/schema.ts";
import { isApproved, pipelineOf } from "../pipeline/pipeline.ts";
import { allRecords, findRecord, setFields, type WorkRecord } from "../records/records.ts";

/** One file per repo, outside it: what this machine is working on is not a record. */
const workFile = (repo: string): string => join(process.env.CANON_HOME ?? join(homedir(), ".canon"), "work", `${basename(repo)}.txt`);

export function readWork(repo: string): string | null {
  const file = workFile(repo);
  return existsSync(file) ? readFileSync(file, "utf8").trim() || null : null;
}

export function clearWork(repo: string): void {
  rmSync(workFile(repo), { force: true });
}

export function selectWork(repo: string, config: Config, recordId: string): void {
  const record = findRecord(repo, config, recordId);
  const file = workFile(repo);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${record.id}\n`);
}

const stagesFor = (config: Config, record: WorkRecord): StageSpec[] => pipelineOf(config, String(record.data.pipeline ?? "default"));

/** The stage a run or an edit put the record at, or else where its kind of record starts. */
export function stageOfRecord(config: Config, record: WorkRecord): string | null {
  const stages = stagesFor(config, record);
  const saved = stages.find((stage) => stage.id === record.data.stage);
  return (saved ?? stages.find((stage) => stage.done.includes(join(".context", record.kind.folder))))?.id ?? null;
}

const needsApproval = (stage: StageSpec, record: WorkRecord): boolean => stage.gate && !isApproved(stage, record.data);

/** Moves a record's stage. Moving forward stops at the first gate in the way, with no approval touched, so that gate waits for a person. */
function moveTo(repo: string, config: Config, record: WorkRecord, target: StageSpec): void {
  const stages = stagesFor(config, record);
  const current = stageOfRecord(config, record);
  const from = stages.findIndex((stage) => stage.id === current);
  const to = stages.indexOf(target);
  const blocker = stages.slice(Math.max(from, 0), Math.max(to, 0)).find((stage) => needsApproval(stage, record) && (stage.id === current || !stage.optional));
  if (blocker) return setFields(repo, record.file, { stage: blocker.id, drafting: null });
  setFields(repo, record.file, { stage: target.id, drafting: needsApproval(target, record) ? target.id : null });
}

export function setStage(repo: string, config: Config, recordId: string, stageId: string): void {
  const record = findRecord(repo, config, recordId);
  const stages = stagesFor(config, record);
  const target = stages.find((stage) => stage.id === stageId);
  if (!target) throw new Error(`no stage "${stageId}" here: ${stages.map((stage) => stage.id).join(", ")}`);
  moveTo(repo, config, record, target);
}

/** What an edit says about the work: a record's page selects it if nothing is selected, and a later stage's folder moves the selected record there. */
export function followEdit(repo: string, config: Config, path: string): void {
  const file = relative(repo, path);
  const records = allRecords(repo, config);
  const selected = readWork(repo);
  const record = records.find((entry) => entry.id === selected);
  if (!record) {
    const page = records.find((entry) => entry.file === file && !entry.kind.closed.includes(String(entry.data.status)));
    if (page) selectWork(repo, config, page.id);
    return;
  }
  const stages = stagesFor(config, record);
  const target = stages.find((stage) => stage.done.some((done) => file === done || file.startsWith(`${done}/`)));
  // shortcut: edits only move forward, so a stray one is undone with canon work --stage; send work back with canon reject.
  if (!target || stages.indexOf(target) <= stages.findIndex((stage) => stage.id === stageOfRecord(config, record))) return;
  moveTo(repo, config, record, target);
}
