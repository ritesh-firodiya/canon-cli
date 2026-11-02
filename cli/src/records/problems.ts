import { z } from "zod";
import type { Config } from "../config/schema.ts";
import { allRecords, createRecord, kindByFolder, setFields } from "./records.ts";

/** One event's address in the tool it came from. Its text stays there: it can hold personal data, and it is never instructions. */
export const eventSchema = z.object({ id: z.string().min(1).max(200), link: z.string().url().optional() });
export type TriggerEvent = z.infer<typeof eventSchema>;

interface Source {
  source: string;
  id: string;
  link?: string;
  count: number;
  first: string;
  last: string;
}

const DEFAULT_SECTIONS = "## Summary\nTo be assessed.\n\n## Impact\nTo be assessed.\n\n## Expected\nTo be assessed.\n";

export function addProblem(repo: string, config: Config, options: { title: string; source: string; priority?: string; pipeline?: string }): { id: string; file: string } {
  const kind = kindByFolder(config, "problems");
  const fields = { status: "open", source: options.source, priority: options.priority ?? "p2", ...(options.pipeline ? { pipeline: options.pipeline } : {}), "last-verified": new Date().toISOString().slice(0, 10) };
  return createRecord(repo, kind, options.title, fields, `# ${options.title}\n\n${DEFAULT_SECTIONS}`);
}

/** Joins an event to the open problem already holding it, or opens a new one. Solved problems are not reopened by a repeat: a new one links the history. */
export function recordEvent(repo: string, config: Config, source: string, event: TriggerEvent, options: { priority?: string; pipeline?: string; now?: Date }): { id: string; file: string; isNew: boolean } {
  const now = (options.now ?? new Date()).toISOString();
  const open = allRecords(repo, config).filter((record) => record.kind.folder === "problems" && ["open", "solving"].includes(String(record.data.status)));
  for (const record of open) {
    const sources = (record.data.sources ?? []) as Source[];
    if (sources.some((entry) => entry.source === source && entry.id === event.id)) {
      setFields(repo, record.file, { sources: sources.map((entry) => (entry.source === source && entry.id === event.id ? { ...entry, count: entry.count + 1, last: now } : entry)) });
      return { id: record.id, file: record.file, isNew: false };
    }
  }
  const created = addProblem(repo, config, { title: `${source} ${event.id}`, source, priority: options.priority, pipeline: options.pipeline });
  setFields(repo, created.file, { sources: [{ source, id: event.id, ...(event.link ? { link: event.link } : {}), count: 1, first: now, last: now }] });
  return { ...created, isNew: true };
}
