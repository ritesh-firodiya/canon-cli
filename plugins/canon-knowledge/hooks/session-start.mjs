// Refreshes the search index in the background and points the session at it.
import { spawn } from "node:child_process";

const child = spawn("qmd", ["update"], { detached: true, stdio: "ignore" });
// qmd not installed is fine: the session must still start.
child.on("error", () => {});
child.unref();

const context = [
  "Knowledge lookup: for any question about a product's prices, rules, decisions,",
  "features or past choices, call mcp__plugin_canon-knowledge_qmd__query FIRST, then read the",
  "hits with mcp__plugin_canon-knowledge_qmd__get. Use grep only for code, or when qmd finds nothing.",
].join("\n");

process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } }));
