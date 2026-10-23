// Puts the constitution's principle titles in front of every session, so a
// verdict can cite an ID without loading the whole file, and refreshes the QMD
// index in the background so new wiki pages are searchable.
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.env.CLAUDE_PLUGIN_ROOT ?? join(import.meta.dirname, "..");
const PRINCIPLE = /^### (C-\d{2} .+)$/;

// The CLI knows the team's additions (configured standards folders); without
// it, zeno's own constitution is still enough to weigh with.
function principleTitles() {
  const cli = spawnSync("zeno", ["standards", "--constitution", "--json"], { encoding: "utf8", timeout: 5000 });
  if (cli.status === 0) {
    try {
      return JSON.parse(cli.stdout).map((title) => `- ${title}`);
    } catch {}
  }
  try {
    return readFileSync(join(root, "standards", "constitution.md"), "utf8")
      .split("\n")
      .flatMap((line) => (PRINCIPLE.test(line) ? [`- ${line.match(PRINCIPLE)[1]}`] : []));
  } catch (error) {
    return [`- (constitution unreadable: ${error.message})`];
  }
}

function refreshSearchIndex() {
  const child = spawn("qmd", ["update"], { detached: true, stdio: "ignore" });
  // qmd not installed is fine: search is optional, the session must still start.
  child.on("error", () => {});
  child.unref();
}

refreshSearchIndex();

const context = [
  "zeno constitution — run the weigh skill on any non-trivial request before acting;",
  "cite principle IDs in verdicts. `zeno standards` lists every standard that applies here.",
  ...principleTitles(),
  "",
  "Knowledge lookup: for any question about a product's prices, rules, decisions,",
  "features or past choices, call mcp__plugin_zeno_qmd__query FIRST, then read the",
  "hits with mcp__plugin_zeno_qmd__get. Use grep only for code, or when qmd finds nothing.",
  "Decisions and ADRs: use the zeno decision skill (it follows the wiki schema), not other ADR skills.",
].join("\n");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
  }),
);
