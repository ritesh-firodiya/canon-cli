import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument, stringify } from "yaml";
import type { Config, RecordKind } from "../config/schema.ts";
import { parseFrontmatter } from "../lib/frontmatter.ts";

export interface WorkRecord {
  id: string;
  /** Repo-relative. */
  file: string;
  kind: RecordKind;
  data: Record<string, unknown>;
  body: string;
}

const RECORD_FILE = /^(\d{4})-.+\.md$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function recordFiles(repo: string, kind: RecordKind): string[] {
  const dir = join(repo, ".context", kind.folder);
  return existsSync(dir) ? readdirSync(dir).filter((name) => (kind.named ? name.endsWith(".md") && name !== "index.md" : RECORD_FILE.test(name))).sort() : [];
}

export function allRecords(repo: string, config: Config): WorkRecord[] {
  return config.records.flatMap((kind) =>
    recordFiles(repo, kind).flatMap((name) => {
      const file = join(".context", kind.folder, name);
      const { data, body } = parseFrontmatter(readFileSync(join(repo, file), "utf8"));
      return data ? [{ id: String(kind.named ? data.name : data.id), file, kind, data, body }] : [];
    }),
  );
}

export function findRecord(repo: string, config: Config, id: string): WorkRecord {
  const found = allRecords(repo, config).find((record) => record.id === id);
  if (!found) throw new Error(`no record ${id} in ${repo}`);
  return found;
}

/** Changes frontmatter fields and keeps the rest of the page as written. A null value removes the field. */
export function setFields(repo: string, file: string, fields: Record<string, unknown>): void {
  const path = join(repo, file);
  const text = readFileSync(path, "utf8");
  const match = FRONTMATTER.exec(text);
  if (!match) throw new Error(`${file} has no frontmatter`);
  const doc = parseDocument(match[1]);
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) doc.delete(key);
    else doc.set(key, doc.createNode(value));
  }
  writeFileSync(path, `---\n${doc.toString().trimEnd()}\n---\n${text.slice(match[0].length)}`);
}

/** Adds lines to a `## ` section, making the section when the page has none. */
export function appendToSection(repo: string, file: string, section: string, lines: string): void {
  const path = join(repo, file);
  const text = readFileSync(path, "utf8");
  const heading = new RegExp(`^## ${section}[ \\t]*$`, "m").exec(text);
  if (!heading) {
    writeFileSync(path, `${text.trimEnd()}\n\n## ${section}\n${lines}\n`);
    return;
  }
  const start = heading.index + heading[0].length;
  const next = text.slice(start).search(/^## /m);
  const end = next === -1 ? text.length : start + next;
  writeFileSync(path, `${text.slice(0, end).trimEnd()}\n${lines}\n${next === -1 ? "" : `\n${text.slice(end)}`}`);
}

const toSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "record";

/** Writes a new record: the next number for its kind, or its unique name. */
export function createRecord(repo: string, kind: RecordKind, slug: string, fields: Record<string, unknown>, body: string): { id: string; file: string } {
  const dir = join(".context", kind.folder);
  mkdirSync(join(repo, dir), { recursive: true });
  if (kind.named) {
    const name = toSlug(slug);
    const file = join(dir, `${name}.md`);
    if (existsSync(join(repo, file))) throw new Error(`${kind.folder} already has one named ${name}: names are unique`);
    writeFileSync(join(repo, file), `---\n${stringify({ name, ...fields }).trimEnd()}\n---\n${body.trimEnd()}\n`);
    return { id: name, file };
  }
  const last = recordFiles(repo, kind).map((name) => Number(name.slice(0, 4))).reduce((a, b) => Math.max(a, b), 0);
  const number = String(last + 1).padStart(4, "0");
  const id = `${kind.prefix}-${number}`;
  const file = join(dir, `${number}-${toSlug(slug)}.md`);
  writeFileSync(join(repo, file), `---\n${stringify({ id, ...fields }).trimEnd()}\n---\n${body.trimEnd()}\n`);
  return { id, file };
}

export function kindByFolder(config: Config, folder: string): RecordKind {
  const kind = config.records.find((entry) => entry.folder === folder);
  if (!kind) throw new Error(`this repo has no ${folder} records (see records: in context.yaml)`);
  return kind;
}

/** A person's approval of one stage on one record. */
export interface Approval {
  stage: string;
  by: string;
  at: string;
  note?: string;
}

export const approvalsOf = (data: Record<string, unknown>): Approval[] => (Array.isArray(data.approvals) ? (data.approvals as Approval[]) : []);
