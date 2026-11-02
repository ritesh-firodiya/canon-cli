import type { Config, FieldRule, RecordKind } from "../config/schema.ts";

/** Fields only canon writes, so `canon set` cannot forge them. */
export const RESERVED_FIELDS = ["id", "name", "approvals", "rejections", "completed", "skipped", "verified", "stage", "drafting", "cost", "rules", "sources"];
export const OUTCOMES = ["retained", "discarded", "retried"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string) => DATE.test(value) && !Number.isNaN(Date.parse(value));

function ruleProblem(rule: FieldRule, text: string): string | null {
  if (Array.isArray(rule)) return rule.includes(text) ? null : `is not one of ${rule.join(", ")}`;
  if (rule === "date") return isDate(text) ? null : "is not a date like 2026-11-02";
  if (rule === "number") return text !== "" && !Number.isNaN(Number(text)) ? null : "is not a number";
  if (rule === "date-range") {
    const [start, end, ...rest] = text.split("..");
    return isDate(start) && end !== undefined && isDate(end) && rest.length === 0 && start <= end ? null : "is not a date range like 2026-11-02..2026-12-01";
  }
  if (rule === "link") return /^(https?:\/\/\S+|[A-Z]+-\d{4}|[a-z0-9-]+)$/.test(text) ? null : "is not a record or an address";
  return null;
}

/** What is wrong with one field's value here, or null. */
export function fieldProblem(config: Config, kind: RecordKind, field: string, value: unknown): string | null {
  const text = String(value ?? "");
  if (kind.removed.includes(field)) return `${field} is removed for ${kind.folder} here`;
  if (field === "status") return kind.statuses.includes(text) ? null : `status ${text} is not one of ${kind.statuses.join(", ")}`;
  if (field === "priority") return text in config.priorities ? null : `priority ${text} is not one of ${Object.keys(config.priorities).join(", ")}`;
  if (field === "outcome") return OUTCOMES.includes(text) ? null : `outcome ${text} is not one of ${OUTCOMES.join(", ")}`;
  const rule = kind.fields[field];
  const problem = rule ? ruleProblem(rule, text) : null;
  return problem ? `${field} ${text} ${problem}` : null;
}
