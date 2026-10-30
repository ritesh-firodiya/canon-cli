import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const COMMIT_CALL = /\bgit\b[^|;&]*\bcommit\b/;
const WEB_TOOLS = new Set(["WebSearch", "WebFetch"]);

/** One Claude conversation, reduced to counts and times. */
export interface Session {
  start: Date;
  /** When it ran `git commit`. */
  calls: Date[];
  /** When it first searched or fetched the web. */
  web: Date | null;
  /** The product folders it worked in: its working folders and the paths its tools named, never tool output. */
  where: Set<string>;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A product folder named in full or from ~ ("~/products/myapp"), capturing its name. */
export function productPath(workspace: string): RegExp {
  const tilde = workspace.replace(homedir(), "~");
  return new RegExp(`(?:${escape(workspace)}|${escape(tilde)})/([A-Za-z0-9._-]+)`, "g");
}

interface Entry {
  timestamp?: string;
  cwd?: string;
  type?: string;
  isMeta?: boolean;
  message?: { content?: unknown };
}

interface ToolUse {
  type?: string;
  name?: string;
  input?: { command?: unknown };
}

export function readSession(text: string, products: RegExp): Session | null {
  const times: Date[] = [];
  const calls: Date[] = [];
  const where = new Set<string>();
  const named = (value: string) => [...value.matchAll(products)].forEach((m) => where.add(m[1]));
  let asks = 0;
  let web: Date | null = null;
  for (const line of text.split("\n")) {
    let e: Entry;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (!e?.timestamp) continue;
    const t = new Date(e.timestamp);
    times.push(t);
    named(e.cwd ?? "");
    const content = e.message?.content;
    if (e.type === "user" && !e.isMeta && typeof content === "string" && !content.trimStart().startsWith("<")) asks += 1;
    if (e.type !== "assistant" || !Array.isArray(content)) continue;
    for (const c of content as ToolUse[]) {
      if (c?.type !== "tool_use") continue;
      named(JSON.stringify(c.input ?? {}));
      if (WEB_TOOLS.has(c.name ?? "") && web === null) web = t;
      if (typeof c.input?.command === "string" && COMMIT_CALL.test(c.input.command)) calls.push(t);
    }
  }
  if (!times.length || asks === 0) return null;
  return { start: times.reduce((a, b) => (b < a ? b : a)), calls, web, where };
}

/** Every conversation on this machine: one started in ~ or ~/git can still have worked in a product. */
export function allSessions(workspace: string, transcripts = join(homedir(), ".claude", "projects")): Session[] {
  if (!existsSync(transcripts)) return [];
  const products = productPath(workspace);
  return readdirSync(transcripts, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(join(transcripts, d.name)).filter((f) => f.endsWith(".jsonl")).map((f) => join(transcripts, d.name, f)))
    .flatMap((path) => readSession(readFileSync(path, "utf8"), products) ?? []);
}

/**
 * Whether a conversation can be about a product: it worked in the product's folder, or in no product folder
 * (then only its commits can tie it). `where` also catches files like CLAUDE.md, so only product repos count.
 */
export function belongs(where: Set<string>, names: Set<string>, known: Set<string>): boolean {
  const products = [...where].filter((w) => known.has(w));
  return products.some((p) => names.has(p)) || products.length === 0;
}
