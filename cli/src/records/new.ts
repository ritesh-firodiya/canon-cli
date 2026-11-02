import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import type { Config, RecordKind } from "../config/schema.ts";
import { createRecord } from "./records.ts";

const TEMPLATES = resolve(import.meta.dirname, "..", "..", "..", "templates", "records");
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Documents that are not numbered records: named by topic, in the wiki. */
const WIKI_DOCS: Record<string, string> = { discovery: "synthesis", finding: "synthesis", decision: "decisions" };

function splitTemplate(text: string, title: string, today: string): { fields: Record<string, unknown>; body: string } {
  const filled = text.replaceAll("{{title}}", title.replace(/\s+/g, " ")).replaceAll("{{today}}", today);
  const match = FRONTMATTER.exec(filled);
  return match ? { fields: parse(match[1]) ?? {}, body: filled.slice(match[0].length) } : { fields: {}, body: filled };
}

/** A kind with no template, such as a team's own, gets one from what its config requires. */
function generatedTemplate(kind: RecordKind, title: string, today: string): { fields: Record<string, unknown>; body: string } {
  const listed = Object.fromEntries(Object.entries(kind.fields).flatMap(([field, values]) => (values ? [[field, values[0]]] : [])));
  return { fields: { status: kind.statuses[0], ...listed, "last-verified": today }, body: [`# ${title}`, ...kind.sections.map((section) => `\n## ${section}`)].join("\n") };
}

function recordTemplate(repo: string, kind: RecordKind, title: string, today: string): { fields: Record<string, unknown>; body: string } {
  const file = kind.template ? join(repo, kind.template) : join(TEMPLATES, `${kind.folder}.md`);
  if (kind.template && !existsSync(file)) throw new Error(`the template for ${kind.folder}, ${kind.template}, does not exist`);
  return existsSync(file) ? splitTemplate(readFileSync(file, "utf8"), title, today) : generatedTemplate(kind, title, today);
}

/** Starts a page from its template. `what` is a record kind, singular or plural, or discovery, finding or decision. */
export function newPage(repo: string, config: Config, what: string, title: string, fields: Record<string, unknown> = {}, now = new Date()): { id: string; file: string } {
  const today = now.toISOString().slice(0, 10);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "page";
  const wikiFolder = WIKI_DOCS[what];
  if (wikiFolder) {
    const file = join(".context", "wiki", wikiFolder, `${slug}.md`);
    if (existsSync(join(repo, file))) throw new Error(`${file} already exists: one page per topic, so edit it`);
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    const text = readFileSync(join(TEMPLATES, `${what}.md`), "utf8").replaceAll("{{title}}", title.replace(/\s+/g, " ")).replaceAll("{{today}}", today);
    writeFileSync(join(repo, file), text);
    return { id: slug, file };
  }
  const kind = config.records.find((entry) => entry.folder === what || entry.folder === `${what}s`);
  if (!kind) throw new Error(`no kind "${what}" — kinds here: ${[...config.records.map((entry) => entry.folder), ...Object.keys(WIKI_DOCS)].join(", ")}`);
  const template = recordTemplate(repo, kind, title, today);
  const merged: Record<string, unknown> = { ...template.fields, ...(config.owner ? { owner: config.owner } : {}), ...fields };
  // A template's priority may not exist in a repo with its own list: start at that list's least urgent.
  if (merged.priority && !fields.priority && !(String(merged.priority) in config.priorities)) merged.priority = Object.keys(config.priorities).at(-1);
  const missing = Object.keys(kind.fields).filter((field) => !merged[field]);
  if (missing.length) throw new Error(`${kind.folder} needs ${missing.map((field) => `--set ${field}=...`).join(" ")}`);
  return createRecord(repo, kind, title, merged, template.body);
}
