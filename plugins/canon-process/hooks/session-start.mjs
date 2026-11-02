// Puts the constitution's principle titles in front of every session, so a
// verdict can cite an ID without loading the whole file.
import { spawnSync } from "node:child_process";

// The plugin holds no copy of the standards: the CLI knows them and the team's additions.
function principleTitles() {
  const cli = spawnSync("canon", ["standards", "--constitution", "--json"], { encoding: "utf8", timeout: 5000 });
  if (cli.status !== 0) return ["- (canon CLI not found: install @freetesh/canon to read the constitution)"];
  try {
    return JSON.parse(cli.stdout).map((title) => `- ${title}`);
  } catch (error) {
    return [`- (constitution unreadable: ${error.message})`];
  }
}

const context = [
  "canon constitution — run the weigh skill on any non-trivial request before acting;",
  "cite principle IDs in verdicts. `canon standards` lists every standard that applies here.",
  "A request is not a fact: check its claims before acting (C-14). Reply in plain words (C-15).",
  ...principleTitles(),
  "",
  "Decisions and ADRs: use the canon decision skill (it follows the wiki schema), not other ADR skills.",
].join("\n");

process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } }));
