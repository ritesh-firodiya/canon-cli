import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { REMOVED_WIKI_FOLDERS as REMOVED_FOLDERS } from "../config/schema.ts";
import type { Check, Finding } from "./types.ts";
import { wikiPages } from "./wiki-frontmatter.ts";

// Every line here is read by an agent on every task; a cap keeps .context to what it would get wrong without.
const MAX_LINES = { page: 60, decision: 30, readme: 30, tasks: 100 };
const DATED_NAME = /^\d{4}-\d{2}-\d{2}-/;

const lineCount = (repo: string, file: string) => readFileSync(join(repo, file), "utf8").trimEnd().split("\n").length;

export const contextSize: Check = {
  id: "context-size",
  module: "docs",
  description: "pages, decisions, README.md and tasks.md stay under their line caps; decisions are one file per topic; no flow pages",
  run({ repo }) {
    const findings: Finding[] = [];
    const warn = (file: string, message: string) => findings.push({ check: "context-size", level: "warn", file, message });
    const overCap = (file: string, cap: number) => {
      const lines = lineCount(repo, file);
      if (lines > cap) warn(file, `${lines} lines, cap ${cap} — cut what code, designs or git already say`);
    };

    for (const [folder, why] of Object.entries(REMOVED_FOLDERS)) {
      if (existsSync(join(repo, ".context/wiki", folder))) warn(`.context/wiki/${folder}`, `${folder}/ is gone: ${why}`);
    }
    for (const file of wikiPages(repo)) {
      const folder = file.split("/")[2];
      if (folder === "synthesis" || folder in REMOVED_FOLDERS) continue;
      if (folder === "decisions" && DATED_NAME.test(basename(file))) {
        warn(file, "name a decision by topic and edit it in place — git keeps the history");
      }
      overCap(file, folder === "decisions" ? MAX_LINES.decision : MAX_LINES.page);
    }

    const readme = ".context/README.md";
    const tasks = ".context/tasks.md";
    if (existsSync(join(repo, readme))) overCap(readme, MAX_LINES.readme);
    if (existsSync(join(repo, tasks))) {
      overCap(tasks, MAX_LINES.tasks);
      if (/^## (Done|Session Notes)\b/m.test(readFileSync(join(repo, tasks), "utf8"))) {
        warn(tasks, "tasks.md holds only open work — delete done tasks and session notes; the commits record them");
      }
    }
    return findings;
  },
};
