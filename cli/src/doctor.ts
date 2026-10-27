import { spawnSync } from "node:child_process";
import type { ToolSpec } from "./config/schema.ts";

/** Runs `<command> --version` and returns its first output line, or null if the command is missing. */
export type Probe = (command: string) => string | null;

export interface ToolStatus {
  tool: string;
  ok: boolean;
  version?: string;
  why: string;
  hint?: string;
}

interface Tool extends ToolSpec {
  minimum?: [number, number];
}

// What canon itself needs. A repo or estate adds its own under `doctor.tools`.
const CORE_TOOLS: Tool[] = [
  { tool: "node", why: "runs the canon CLI and hooks", hint: "install Node 22+", minimum: [22, 0] },
  { tool: "git", why: "canon works on git repos", hint: "install git" },
  { tool: "qmd", why: "knowledge search for Claude", hint: "npm i -g @tobilu/qmd (see the canon README)" },
];

const VERSION = /(\d+)\.(\d+)(?:\.(\d+))?/;

export const systemProbe: Probe = (command) => {
  const result = spawnSync(command, ["--version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) return null;
  return `${result.stdout}${result.stderr}`.trim().split("\n")[0];
};

export function runDoctor(probe: Probe = systemProbe, extra: ToolSpec[] = []): ToolStatus[] {
  const tools: Tool[] = [...CORE_TOOLS, ...extra];
  return tools.map(({ tool, why, hint, minimum }) => {
    const output = probe(tool);
    if (output === null) return { tool, ok: false, why, hint };
    const match = VERSION.exec(output);
    const version = match?.[0];
    if (minimum && match) {
      const [major, minor] = [Number(match[1]), Number(match[2])];
      const tooOld = major < minimum[0] || (major === minimum[0] && minor < minimum[1]);
      if (tooOld) return { tool, ok: false, version, why, hint };
    }
    return { tool, ok: true, version, why };
  });
}
