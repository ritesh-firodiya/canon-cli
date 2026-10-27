import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check, Finding } from "./types.ts";

const TASKS = ".context/tasks.md";
const COMMENT = /<!--[\s\S]*?-->/g;
const ITEM = /^(?:\d+\.|[-*]) \[[ xX]\] +(T\d+\b)?/gm;
const ISO_DATE = /\d{4}-\d{2}-\d{2}/;
// A blocker with no way out and no check date is the silent leak the format exists to stop.
const BLOCKED_FIELDS = ["blocked-by", "unblock", "next-check"];

function sectionOf(text: string, name: string): string {
  const clean = text.replace(COMMENT, "");
  const headings = [...clean.matchAll(/^## +(\S[^\n]*?)[ \t]*$/gm)];
  const at = headings.findIndex((heading) => heading[1].startsWith(name));
  if (at === -1) return "";
  const start = headings[at].index! + headings[at][0].length;
  return clean.slice(start, headings[at + 1]?.index ?? clean.length);
}

function fieldOf(item: string, field: string): string | null {
  const found = new RegExp(`(?<![\\w-])${field}:[ \\t]*([^\\n]*)`).exec(item);
  return found ? found[1].trim() : null;
}

function asDate(value: string): Date | null {
  const found = ISO_DATE.exec(value);
  if (!found) return null;
  const date = new Date(`${found[0]}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== found[0] ? null : date;
}

export const tasks: Check = {
  id: "tasks",
  module: null,
  description: "every blocked task has an id, blocked-by, unblock and next-check; a passed date is a note",
  run({ repo, today }) {
    const path = join(repo, TASKS);
    if (!existsSync(path)) return [];
    const text = readFileSync(path, "utf8");
    const findings: Finding[] = [];
    const add = (level: Finding["level"], message: string) => findings.push({ check: "tasks", level, file: TASKS, message });

    const horizon = /^horizon:\s*(\S+)/m.exec(text);
    const horizonDate = horizon ? asDate(horizon[1]) : null;
    if (horizonDate && horizonDate < today) add("warn", `past its horizon (${horizon![1]}) — regenerate it`);

    const blocked = sectionOf(text, "Blocked");
    const starts = [...blocked.matchAll(ITEM)];
    starts.forEach((start, index) => {
      const item = blocked.slice(start.index, starts[index + 1]?.index ?? blocked.length);
      const id = start[1];
      if (!id) return add("error", `blocked item without a task id: ${item.split("\n")[0].trim().slice(0, 60)}`);
      for (const field of BLOCKED_FIELDS) if (!fieldOf(item, field)) add("error", `${id} is blocked without ${field}:`);
      // next-check may be prose ("after T010"); only something shaped like a date can be a bad one.
      const check = fieldOf(item, "next-check") ?? "";
      if (ISO_DATE.test(check)) {
        const on = asDate(check);
        if (!on) add("error", `${id} next-check: ${check} is not a date`);
        else if (on < today) add("warn", `${id} was to be checked on ${check}`);
      }
    });
    return findings;
  },
};
