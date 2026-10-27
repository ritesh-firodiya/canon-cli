import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Approval {
  stage: string;
  /** When a person approved the gate. Approvals are never backdated. */
  at: string;
  note: string;
}

// In raw/, which is append-only: the dates are the record of how long each stage waited.
export const GATES_LOG = join(".context", "raw", "zeno", "gates.jsonl");

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
