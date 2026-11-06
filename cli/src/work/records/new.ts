import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import type { Config, RecordKind } from "../../config/schema.ts";
import { CANON_ROOT } from "../../lib/root.ts";
import { fieldProblem } from "./fields.ts";
import { createRecord } from "./records.ts";

const TEMPLATES = join(CANON_ROOT, "templates", "records");
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Documents that are not numbered records: named by topic, in the wiki, or by date in raw/. */
const WIKI_DOCS: Record<string, string> = { discovery: "wiki/synthesis", finding: "wiki/synthesis", decision: "wiki/decisions", fact: "raw" };

function splitTemplate(text: string, title: string, today: string): { fields: Record<string, unknown>; body: string } {
  const filled = text.replaceAll("{{title}}", title.replace(/\s+/g, " ")).replaceAll("{{today}}", today);
  const match = FRONTMATTER.exec(filled);
  return match ? { fields: parse(match[1]) ?? {}, body: filled.slice(match[0].length) } : { fields: {}, body: filled };
}

/** A kind with no template, such as a team's own, gets one from what its config requires. */
function generatedTemplate(kind: RecordKind, title: string, today: string): { fields: Record<string, unknown>; body: string } {
  const listed = Object.fromEntries(Object.entries(kind.fields).flatMap(([field, rule]) => (Array.isArray(rule) ? [[field, rule[0]]] : [])));
  return { fields: { status: kind.statuses[0], ...listed, "last-verified": today }, body: [`# ${title}`, ...kind.sections.map((section) => `\n## ${section}`)].join("\n") };
}

/** The repo's own `.context/templates/<name>.md` first, then canon's. */
function templateFile(repo: string, name: string): string {
  const own = join(repo, ".context", "templates", `${name}.md`);
  return existsSync(own) ? own : join(TEMPLATES, `${name}.md`);
}

function recordTemplate(repo: string, kind: RecordKind, title: string, today: string): { fields: Record<string, unknown>; body: string } {
  const file = templateFile(repo, kind.folder);
  return existsSync(file) ? splitTemplate(readFileSync(file, "utf8"), title, today) : generatedTemplate(kind, title, today);
}

/** Starts a page from its template. `what` is a record kind, singular or plural, or discovery, finding or decision. */
export function newPage(repo: string, config: Config, what: string, title: string, fields: Record<string, unknown> = {}, now = new Date()): { id: string; file: string } {
  const today = now.toLocaleDateString("sv-SE"); // local YYYY-MM-DD; the UTC date is a day off near midnight
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "page";
  const wikiFolder = WIKI_DOCS[what];
  if (wikiFolder) {
    const file = join(".context", wikiFolder, `${wikiFolder === "raw" ? `${today}-` : ""}${slug}.md`);
    if (existsSync(join(repo, file))) throw new Error(`${file} already exists: one page per topic, so edit it`);
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    const text = readFileSync(templateFile(repo, what), "utf8").replaceAll("{{title}}", title.replace(/\s+/g, " ")).replaceAll("{{today}}", today);
    writeFileSync(join(repo, file), text);
    return { id: slug, file };
  }
  const kind = config.records.find((entry) => entry.folder === what || entry.folder === `${what}s`);
  if (!kind) throw new Error(`no kind "${what}" — kinds here: ${[...config.records.map((entry) => entry.folder), ...Object.keys(WIKI_DOCS)].join(", ")}`);
  const template = recordTemplate(repo, kind, title, today);
  const merged: Record<string, unknown> = { ...template.fields, ...(config.owner ? { owner: config.owner } : {}), ...fields };
  // A template's priority may not exist in a repo with its own list: start at that list's least urgent.
  if (merged.priority && !fields.priority && !(String(merged.priority) in config.priorities)) merged.priority = Object.keys(config.priorities).at(-1);
  for (const field of kind.removed) delete merged[field];
  const missing = kind.required.filter((field) => !field.startsWith("## ") && !merged[field]);
  if (missing.length) throw new Error(`${kind.folder} needs ${missing.map((field) => `--set ${field}=...`).join(" ")}`);
  for (const [field, value] of Object.entries(fields)) {
    const problem = fieldProblem(config, kind, field, value);
    if (problem) throw new Error(problem);
  }
  return createRecord(repo, kind, title, merged, template.body);
}
