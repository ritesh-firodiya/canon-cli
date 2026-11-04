import type { Config } from "../../config/schema.ts";
import { fieldProblem, RESERVED_FIELDS } from "./fields.ts";
import { findRecord, setFields } from "./records.ts";

/** Changes fields a person owns, each checked against this repo's rules. */
export function setRecordFields(repo: string, config: Config, recordId: string, fields: Record<string, string>): void {
  const record = findRecord(repo, config, recordId);
  for (const [field, value] of Object.entries(fields)) {
    if (RESERVED_FIELDS.includes(field)) throw new Error(`${field} is written by canon, not by hand`);
    const problem = fieldProblem(config, record.kind, field, value);
    if (problem) throw new Error(problem);
  }
  setFields(repo, record.file, fields);
}

/** Marks a record complete with its kind's first closing status, and returns that status. */
export function markDone(repo: string, config: Config, recordId: string): string {
  const record = findRecord(repo, config, recordId);
  const status = record.kind.closed[0];
  if (!status) throw new Error(`${record.kind.folder} has no closing status: set closed: under records`);
  setFields(repo, record.file, { status });
  return status;
}
