import { spawnSync } from "node:child_process";
import type { AgentSpec } from "../config/schema.ts";
import { claudeAgent, type Agent } from "./run.ts";

const TIMEOUT_MS = 60 * 60 * 1000;
const MAX_BUFFER = 64 * 1024 * 1024;

const fill = (arg: string, values: Record<string, string>): string => arg.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

/** The agent a repo names: Claude Code by default, or any command that takes a prompt. */
export function agentFor(spec: AgentSpec | undefined): Agent {
  if (!spec || spec === "claude") return claudeAgent;
  // shortcut: a custom agent reports no dollars, so the cap is not enforced; add a cost reader when one needs it.
  return ({ prompt, cwd, small, model }) => {
    const chosen = model ?? (small ? spec.smallModel : undefined);
    const values = { prompt, model: chosen ?? "" };
    const args = [...spec.args, ...(chosen ? (spec.modelArgs ?? []) : [])].map((arg) => fill(arg, values));
    const run = spawnSync(spec.command, args, { cwd, encoding: "utf8", timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, env: { ...process.env, CANON_RUN: "1" } });
    if (run.error) return { ok: false, costUsd: 0, text: run.error.message };
    return { ok: run.status === 0, costUsd: 0, text: run.status === 0 ? run.stdout : (run.stderr || run.stdout).slice(0, 500) };
  };
}
