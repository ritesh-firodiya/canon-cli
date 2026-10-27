import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { CONTEXT_FOLDERS, type Module } from "../config/schema.ts";
import type { Check, Finding } from "./types.ts";

const KNOWLEDGE_CONTEXT = ["raw", "wiki", "features"];

/** What .context must hold: README.md and tasks.md always, the knowledge folders only when docs or knowledge is on. */
export function requiredContext(modules: Module[]): string[] {
  const knowledge = modules.includes("docs") || modules.includes("knowledge");
  return ["README.md", "tasks.md", ...(knowledge ? KNOWLEDGE_CONTEXT : [])];
}
const ROOT_FILES = ["README.md", "tasks.md"];
const LIVE_FOLDERS = ["marketing", "metrics", "support", "legal"];
const ROOT_STRAYS = ["TODO.md", "STATUS.md", "SETUP.md"];

function emptyFolders(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.length === 0) return [dir];
  return entries.filter((entry) => entry.isDirectory()).flatMap((entry) => emptyFolders(join(dir, entry.name)));
}

function ignored(repo: string, path: string): boolean {
  return spawnSync("git", ["-C", repo, "check-ignore", "-q", path]).status === 0;
}

export const contextLayout: Check = {
  id: "context-layout",
  module: null,
  description: ".context/ has the required folders, only the allowed ones (the ten plus context.folders), and only README.md + tasks.md at its root",
  run({ repo, config }) {
    const context = join(repo, ".context");
    const finding = (level: Finding["level"], file: string, message: string): Finding => ({
      check: "context-layout",
      level,
      file,
      message,
    });
    if (!existsSync(context)) return [finding("error", ".context", "no .context/ folder — run `zeno init`")];

    const findings = requiredContext(config.modules).filter((name) => !existsSync(join(context, name))).map((name) =>
      finding("error", `.context/${name}`, `required ${name} is missing`),
    );
    const allowed = [...CONTEXT_FOLDERS, ...config.context.folders.map((entry) => entry.folder)];
    for (const entry of readdirSync(context, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      if (entry.isDirectory() && !allowed.includes(entry.name)) {
        findings.push(finding("error", `.context/${entry.name}`, `${entry.name}/ is not an allowed folder — move it, or add it under context.folders in zeno.yaml`));
      }
      if (entry.isFile() && !ROOT_FILES.includes(entry.name)) {
        findings.push(finding("error", `.context/${entry.name}`, "only README.md and tasks.md may sit at .context/ root"));
      }
    }
    if (existsSync(join(context, "raw")) && !existsSync(join(context, "raw", ".gitkeep"))) {
      findings.push(finding("warn", ".context/raw/.gitkeep", "raw/ needs its .gitkeep so it survives a clean clone"));
    }
    // git drops an empty folder on clone, so on disk it promises something that is not there.
    // A gitignored one is tool output that recreates itself.
    for (const empty of emptyFolders(context)) {
      if (empty !== join(context, "raw") && !ignored(repo, empty)) {
        findings.push(finding("error", relative(repo, empty), "empty folder — git will drop it"));
      }
    }
    // Once something is live, the go-to-market folders are owed. release.yml is the stage signal.
    const release = join(context, "ops", "release.yml");
    if (existsSync(release) && /^\s+live:(?!\s*null)/m.test(readFileSync(release, "utf8"))) {
      for (const owed of LIVE_FOLDERS) {
        if (!existsSync(join(context, owed))) findings.push(finding("error", `.context/${owed}`, `live (ops/release.yml) but no ${owed}/`));
      }
    }
    for (const stray of ROOT_STRAYS) {
      if (existsSync(join(repo, stray))) findings.push(finding("error", stray, "nothing renders it at the root — it belongs in .context/ (tasks.md, ops/)"));
    }
    if (existsSync(join(repo, "docs"))) findings.push(finding("error", "docs/", "a root docs/ folder — that material belongs in .context/"));
    if (existsSync(join(repo, "store.config.json")) && existsSync(join(context, "listing", "ios"))) {
      findings.push(finding("error", "store.config.json", "two Apple listings — .context/listing/ios/ is the one source"));
    }
    // Without the pointer the whole .context/ tree is invisible to an agent.
    const agents = join(repo, "AGENTS.md");
    if (existsSync(agents) && !readFileSync(agents, "utf8").includes("tasks.md")) {
      findings.push(finding("error", "AGENTS.md", "does not point at .context/tasks.md"));
    }
    return findings;
  },
};
