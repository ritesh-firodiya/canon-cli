import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { sep } from "node:path";
import { perTranscript, TRANSCRIPTS, transcriptFiles } from "../lib/transcripts.ts";

const WEB_TOOLS = new Set(["WebSearch", "WebFetch"]);
export const COMMIT_CALL = /\bgit\b[^|;&]*\bcommit\b/;

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
  let web: Date | null = null;
  let asks = 0;
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

type Stored = { start: string; calls: string[]; web: string | null; where: string[] } | null;

const store = (session: Session | null): Stored =>
  session && { start: session.start.toISOString(), calls: session.calls.map((d) => d.toISOString()), web: session.web?.toISOString() ?? null, where: [...session.where] };
const revive = (stored: Stored): Session | null =>
  stored && { start: new Date(stored.start), calls: stored.calls.map((d) => new Date(d)), web: stored.web ? new Date(stored.web) : null, where: new Set(stored.where) };

/** Every conversation on this machine: one started in ~ or ~/git can still have worked in a product. A subagent's is part of its parent's. */
export function allSessions(workspace: string, transcripts = TRANSCRIPTS, cacheDir?: string): Session[] {
  const products = productPath(workspace);
  const files = transcriptFiles(transcripts).filter((file) => !file.includes(`${sep}subagents${sep}`));
  // The workspace decides what counts as a product, so it is part of the cache's name.
  const kind = `flow-v1-${workspace.replace(/[^A-Za-z0-9]+/g, "-")}`;
  return perTranscript(kind, files, (file) => store(readSession(readFileSync(file, "utf8"), products)), cacheDir).flatMap((stored) => revive(stored) ?? []);
}

/**
 * Whether a conversation can be about a product: it worked in the product's folder, or in no product folder
 * (then only its commits can tie it). `where` also catches files like CLAUDE.md, so only product repos count.
 */
export function belongs(where: Set<string>, names: Set<string>, known: Set<string>): boolean {
  const products = [...where].filter((w) => known.has(w));
  return products.some((p) => names.has(p)) || products.length === 0;
}
