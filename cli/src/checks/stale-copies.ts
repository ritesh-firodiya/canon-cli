import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "./types.ts";

// Instruction files for agents other than Claude Code. They are copies of
// AGENTS.md that nobody reads, so they only drift.
const OTHER_AGENT_FILES = [".github/copilot-instructions.md", ".cursorrules", ".windsurfrules"];
const MAX_POINTER_LINES = 15;

// A short file that sends the agent to AGENTS.md says nothing that can drift.
function isPointer(path: string): boolean {
  const text = readFileSync(path, "utf8");
  return text.includes("AGENTS.md") && text.trimEnd().split("\n").length <= MAX_POINTER_LINES;
}

export const staleCopies: Check = {
  id: "stale-copies",
  module: null,
  description: "no instruction files for agents that are not used (Copilot, Cursor, Windsurf), unless a short pointer to AGENTS.md",
  run({ repo }) {
    return OTHER_AGENT_FILES.filter((file) => existsSync(join(repo, file)) && !isPointer(join(repo, file))).map((file) => ({
      check: "stale-copies",
      level: "warn" as const,
      file,
      message: "instructions for an agent not in use — delete, Claude reads AGENTS.md",
    }));
  },
};
