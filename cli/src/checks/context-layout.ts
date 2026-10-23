import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Check, Finding } from "./types.ts";

const ALLOWED_FOLDERS = ["raw", "wiki", "features", "designs", "listing", "marketing", "metrics", "support", "legal", "ops"];
export const REQUIRED_CONTEXT = ["README.md", "tasks.md", "raw", "wiki", "features"];
const ROOT_FILES = ["README.md", "tasks.md"];

export const contextLayout: Check = {
  id: "context-layout",
  module: null,
  description: ".context/ has the required folders, only the ten allowed ones, and only README.md + tasks.md at its root",
  run({ repo, config }) {
    const context = join(repo, ".context");
    const finding = (level: Finding["level"], file: string, message: string): Finding => ({
      check: "context-layout",
      level,
      file,
      message,
    });
    if (!existsSync(context)) return [finding("error", ".context", "no .context/ folder — run `zeno init`")];

    const findings = REQUIRED_CONTEXT.filter((name) => !existsSync(join(context, name))).map((name) =>
      finding("error", `.context/${name}`, `required ${name} is missing`),
    );
    // Drawing the designs is pipeline stage 1, so a design product without them
    // has not started; zeno init cannot create them for it.
    if (config.modules.includes("design") && !existsSync(join(context, "designs"))) {
      findings.push(finding("error", ".context/designs", "no designs yet — stage 1 (HTML designs) comes before any code"));
    }
    for (const entry of readdirSync(context, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      if (entry.isDirectory() && !ALLOWED_FOLDERS.includes(entry.name)) {
        findings.push(finding("error", `.context/${entry.name}`, `${entry.name}/ is not one of the ten folders`));
      }
      if (entry.isFile() && !ROOT_FILES.includes(entry.name)) {
        findings.push(finding("error", `.context/${entry.name}`, "only README.md and tasks.md may sit at .context/ root"));
      }
    }
    if (existsSync(join(context, "raw")) && !existsSync(join(context, "raw", ".gitkeep"))) {
      findings.push(finding("warn", ".context/raw/.gitkeep", "raw/ needs its .gitkeep so it survives a clean clone"));
    }
    return findings;
  },
};
