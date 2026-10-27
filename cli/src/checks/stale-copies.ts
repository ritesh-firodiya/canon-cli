import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "./types.ts";

// Instruction files for agents other than Claude Code. They are copies of
// AGENTS.md that nobody reads, so they only drift.
const OTHER_AGENT_FILES = [".github/copilot-instructions.md", ".cursorrules", ".windsurfrules"];

export const staleCopies: Check = {
  id: "stale-copies",
  module: null,
  description: "no instruction files for agents that are not used (Copilot, Cursor, Windsurf)",
  run({ repo }) {
    return OTHER_AGENT_FILES.filter((file) => existsSync(join(repo, file))).map((file) => ({
      check: "stale-copies",
      level: "warn" as const,
      file,
      message: "instructions for an agent not in use — delete, Claude reads AGENTS.md",
    }));
  },
};
