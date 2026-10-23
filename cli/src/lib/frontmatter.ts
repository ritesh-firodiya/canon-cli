import { parse } from "yaml";

export interface ParsedPage {
  data: Record<string, unknown> | null;
  body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Splits YAML frontmatter from a Markdown body. Unparseable or absent frontmatter → data null. */
export function parseFrontmatter(text: string): ParsedPage {
  const match = FRONTMATTER.exec(text);
  if (!match) return { data: null, body: text };
  try {
    const data = parse(match[1]);
    const isObject = typeof data === "object" && data !== null && !Array.isArray(data);
    return { data: isObject ? data : null, body: text.slice(match[0].length) };
  } catch {
    return { data: null, body: text.slice(match[0].length) };
  }
}
