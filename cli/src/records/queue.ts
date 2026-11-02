import type { Config } from "../config/schema.ts";
import { isApproved, pipelineOf } from "../pipeline/pipeline.ts";
import { allRecords } from "./records.ts";

export interface QueueRow {
  id: string;
  priority: string | null;
  status: string;
  stage: string | null;
  owner: string | null;
  /** The stage waiting for a person, if any. */
  waiting: string | null;
  file: string;
}

function waitingStage(config: Config, data: Record<string, unknown>): string | null {
  const at = data.at ?? data.stage;
  if (!at || !config.pipelines[String(data.pipeline ?? "default")]) return null;
  const stage = pipelineOf(config, String(data.pipeline ?? "default")).find((entry) => entry.id === at);
  // A gate someone is still working inside is not waiting for its review yet.
  if (data.drafting === at) return null;
  return stage && (stage.gate || stage.by === "person") && !isApproved(stage, data) ? stage.id : null;
}

/** Open work, most urgent first; a record with no priority comes last. Ties stay in record order. */
export function queueOf(repo: string, config: Config): QueueRow[] {
  const order = Object.keys(config.priorities);
  const rank = (priority: string | null) => (priority && order.includes(priority) ? order.indexOf(priority) : order.length);
  return allRecords(repo, config)
    .filter((record) => !record.kind.closed.includes(String(record.data.status)))
    .map(({ id, file, data }) => ({
      id,
      priority: data.priority ? String(data.priority) : null,
      status: data.status ? String(data.status) : "open",
      stage: data.at || data.stage ? String(data.at ?? data.stage) : null,
      owner: data.owner ? String(data.owner) : null,
      waiting: waitingStage(config, data),
      file,
    }))
    .sort((a, b) => rank(a.priority) - rank(b.priority));
}

export function formatQueue(rows: QueueRow[]): string {
  if (rows.length === 0) return "nothing open";
  return rows
    .map((row) => [row.priority ?? "--", row.id.padEnd(10), row.status.padEnd(10), (row.owner ?? "no owner").padEnd(14), row.waiting ? `waits for a person at ${row.waiting}` : (row.stage ?? "not started")].join("  "))
    .join("\n");
}
