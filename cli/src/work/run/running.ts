import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

export interface RunningMark {
  record: string;
  startedAt: string;
  pid: number;
}

/** One file per repo while a run is live, outside the repo: it is a machine's state, not a record. */
export function runningFile(repo: string): string {
  return join(process.env.CANON_HOME ?? join(homedir(), ".canon"), "running", `${basename(repo)}.json`);
}

export function markRunning(repo: string, record: string, now = new Date()): void {
  const file = runningFile(repo);
  mkdirSync(dirname(file), { recursive: true });
  const mark: RunningMark = { record, startedAt: now.toISOString(), pid: process.pid };
  writeFileSync(file, `${JSON.stringify(mark)}\n`);
}

export function clearRunning(repo: string): void {
  rmSync(runningFile(repo), { force: true });
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means it exists under another user.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The live run, or null. A mark left by a process that died is removed. */
export function readRunning(repo: string): RunningMark | null {
  const file = runningFile(repo);
  if (!existsSync(file)) return null;
  try {
    const mark = JSON.parse(readFileSync(file, "utf8")) as RunningMark;
    if (typeof mark.record === "string" && typeof mark.pid === "number" && isAlive(mark.pid)) return mark;
  } catch {
    // A broken mark is no run: it is removed below.
  }
  clearRunning(repo);
  return null;
}
