import type { Config } from "../config/schema.ts";

/** The repo's own vocabulary, in words: what each record kind holds and what its values mean. */
export function describeRecords(config: Config): string {
  const kinds = config.records.map((kind) => {
    const fields = Object.keys(kind.fields);
    const lines = [
      `${kind.folder} (${kind.prefix}-NNNN, .context/${kind.folder}/NNNN-slug.md)`,
      ...(fields.length ? [`  required fields: ${fields.join(", ")}`] : []),
      ...(kind.sections.length ? [`  sections: ${kind.sections.join(", ")}`] : []),
      ...kind.statuses.map((status) => `  status ${status}${kind.closed.includes(status) ? " (closed)" : ""}${kind.meanings.status?.[status] ? `: ${kind.meanings.status[status]}` : ""}`),
      ...Object.entries(kind.meanings).filter(([field]) => field !== "status").flatMap(([field, values]) => Object.entries(values).map(([value, meaning]) => `  ${field} ${value}: ${meaning}`)),
    ];
    return lines.join("\n");
  });
  const priorities = Object.entries(config.priorities).map(([id, meaning]) => `  ${id}: ${meaning}`);
  return [`Priorities, most urgent first:\n${priorities.join("\n")}`, ...(config.owner ? [`Default owner: ${config.owner}`] : []), `Record kinds:\n${kinds.join("\n")}`].join("\n");
}
