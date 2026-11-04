// Refreshes the search index in the background and points the session at it.
import { spawn } from "node:child_process";

const child = spawn("qmd", ["update"], { detached: true, stdio: "ignore" });
// qmd not installed is fine: the session must still start.
child.on("error", () => {});
child.unref();

const context = [
  "For a product's prices, rules, decisions or past choices, search qmd first (mcp__plugin_canon-knowledge_qmd__query, then __get). grep is for code.",
].join("\n");

process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } }));
