import type { Config } from "../config/schema.ts";

/** The repo's own vocabulary, in words: what each record kind holds and what its values mean. */
export function describeRecords(config: Config): string {
  const kinds = config.records.map((kind) => {
    const fields = Object.keys(kind.fields);
    const lines = [
      kind.named ? `${kind.folder} (a unique name, .context/${kind.folder}/<name>.md, with name: in frontmatter)` : `${kind.folder} (${kind.prefix}-NNNN, .context/${kind.folder}/NNNN-slug.md, with id: in frontmatter)`,
      ...(fields.length ? [`  fields: ${fields.map((field) => { const rule = kind.fields[field]; return `${field} (${Array.isArray(rule) ? rule.join(" | ") : rule})`; }).join(", ")}`] : []),
      ...(kind.required.length ? [`  required: ${kind.required.join(", ")}`] : []),
      ...(kind.removed.length ? [`  not used here: ${kind.removed.join(", ")}`] : []),
      ...(kind.sections.length ? [`  usual sections: ${kind.sections.join(", ")}`] : []),
      ...kind.statuses.map((status) => `  status ${status}${kind.closed.includes(status) ? " (closed)" : ""}${kind.meanings.status?.[status] ? `: ${kind.meanings.status[status]}` : ""}`),
      ...Object.entries(kind.meanings).filter(([field]) => field !== "status").flatMap(([field, values]) => Object.entries(values).map(([value, meaning]) => `  ${field} ${value}: ${meaning}`)),
    ];
    return lines.join("\n");
  });
  const priorities = Object.entries(config.priorities).map(([id, meaning]) => `  ${id}: ${meaning}`);
  return [`Priorities, most urgent first:\n${priorities.join("\n")}`, ...(config.owner ? [`Default owner: ${config.owner}`] : []), `Record kinds:\n${kinds.join("\n")}`].join("\n");
}
