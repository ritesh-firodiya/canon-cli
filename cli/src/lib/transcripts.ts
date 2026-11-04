import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CACHE_DIR } from "./system.ts";

/** Where Claude Code keeps each conversation, one .jsonl per session. */
export const TRANSCRIPTS = join(homedir(), ".claude", "projects");

/** Every transcript under root, subagents' included, touched since `since` when given. */
export function transcriptFiles(root = TRANSCRIPTS, since?: Date): string[] {
  if (!existsSync(root)) return [];
  return (readdirSync(root, { recursive: true }) as string[])
    .filter((file) => file.endsWith(".jsonl"))
    .map((file) => join(root, file))
    .filter((file) => !since || statSync(file).mtime >= since);
}

type Stamp = { mtimeMs: number; size: number };
type Cache<T> = Record<string, Stamp & { value: T }>;

/**
 * One result per transcript, computed once and kept until the file changes. `kind` names the reader and its
 * version, so a reader that changes what it keeps starts a new cache instead of reading an old one wrong.
 */
export function perTranscript<T>(kind: string, files: readonly string[], compute: (file: string) => T, cacheDir = CACHE_DIR): T[] {
  const file = join(cacheDir, "transcripts", `${kind}.json`);
  let cache: Cache<T> = {};
  try {
    cache = JSON.parse(readFileSync(file, "utf8")) as Cache<T>;
  } catch {
    // A missing or broken cache is rebuilt from the transcripts.
  }
  const next: Cache<T> = {};
  const values = files.map((path) => {
    const { mtimeMs, size } = statSync(path);
    const hit = cache[path];
    const value = hit && hit.mtimeMs === mtimeMs && hit.size === size ? hit.value : compute(path);
    next[path] = { mtimeMs, size, value };
    return value;
  });
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(next));
  return values;
}
