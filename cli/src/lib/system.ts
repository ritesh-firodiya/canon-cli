import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RunResult } from "../packs/packs.ts";

export const CACHE_DIR = process.env.CANON_CACHE ?? join(homedir(), ".cache", "canon");
const FETCH_TIMEOUT_MS = 30_000;

export function runCommand(command: string, args: string[]): RunResult {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) {
    const missing = (result.error as NodeJS.ErrnoException).code === "ENOENT";
    return { status: 1, output: missing ? `${command} is not installed — run \`canon doctor\`` : result.error.message };
  }
  return { status: result.status ?? 1, output: `${result.stdout}${result.stderr}` };
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
