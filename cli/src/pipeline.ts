import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { StageSpec } from "./config/schema.ts";

export interface Approval {
  stage: string;
  /** When a person approved the gate. Approvals are never backdated. */
  at: string;
  note: string;
}

// In raw/, which is append-only: the dates are the record of how long each stage waited.
export const GATES_LOG = join(".context", "raw", "canon", "gates.jsonl");

export function readApprovals(repo: string): Approval[] {
  const path = join(repo, GATES_LOG);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Approval);
}

export function recordApproval(repo: string, stage: string, note: string): Approval {
  const approval = { stage, at: new Date().toISOString(), note };
  const path = join(repo, GATES_LOG);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(approval)}\n`);
  return approval;
}

export interface StageState {
  id: string;
  gate: boolean;
  /** The first `done` path that exists, or null when the stage has not started. */
  startedAt: string | null;
  /** Whether a person approved this gate; null for a stage with no gate. */
  approved: boolean | null;
}

/** The repo's resolved stages, in order, with where each stands. */
export function stagesOf(repo: string, stages: StageSpec[]): StageState[] {
  const approved = new Set(readApprovals(repo).map((approval) => approval.stage));
  return stages.map((stage) => ({
    id: stage.id,
    gate: stage.gate,
    startedAt: stage.done.find((path) => existsSync(join(repo, path))) ?? null,
    approved: stage.gate ? approved.has(stage.id) : null,
  }));
}
