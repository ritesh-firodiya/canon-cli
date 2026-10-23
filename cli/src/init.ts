import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stringify } from "yaml";
import { REQUIRED_CONTEXT } from "./checks/context-layout.ts";
import { inferKind, inferModules } from "./config/load.ts";
import { MODULES_BY_KIND, type Kind, type Module } from "./config/schema.ts";

export type Runner = (command: string, args: string[]) => void;

export interface InitAnswers {
  zenoVersion: string;
  kind?: Kind;
  modules?: Module[];
  force?: boolean;
}

export interface InitPlan {
  config: { zeno: string; kind: Kind; modules: Module[]; expo?: { sdk: number } };
  /** Files under the repo that will be created; existing files are never touched. */
  create: string[];
}

const PACKAGE_FILES = ["package.json", "apps/mobile/package.json"];

export function detectExpoSdk(repo: string): number | undefined {
  for (const file of PACKAGE_FILES) {
    const path = join(repo, file);
    if (!existsSync(path)) continue;
    const pkg = JSON.parse(readFileSync(path, "utf8"));
    const range: string | undefined = pkg.dependencies?.expo ?? pkg.devDependencies?.expo;
    const major = range?.match(/\d+/)?.[0];
    if (major) return Number(major);
  }
  return undefined;
}

// The first file each required .context entry gets, so no folder is created empty.
const FIRST_FILE: Record<string, string> = {
  "README.md": ".context/README.md",
  "tasks.md": ".context/tasks.md",
  raw: ".context/raw/.gitkeep",
  wiki: ".context/wiki/index.md",
  features: ".context/features/index.md",
};

function template(file: string, today: string): string {
  switch (file) {
    case ".context/README.md":
      return "# .context\n\nProduct material, in the ten folders of the zeno context layout.\n\n## Absent folders\n\n- listing/ — n/a — no store presence yet\n- marketing/, metrics/, support/, legal/ — n/a — not live yet\n- ops/ — n/a — nothing to run yet\n";
    case ".context/tasks.md":
      return `---\nupdated: ${today}\nhorizon: ${today}\n---\n\n# Tasks\n\n## Now\n\n## Parallel\n\n## Blocked\n\n## Waiting\n\n## Done\n\n## Session Notes\n`;
    case ".context/wiki/index.md":
      return "# Wiki index\n\nPages by type. Schema: the zeno plugin's wiki-schema standard.\n";
    case ".context/features/index.md":
      return "# Features\n\n| ID | Title | Status | Release |\n|---|---|---|---|\n";
    default:
      return "";
  }
}

export function planInit(repo: string, answers: InitAnswers): InitPlan {
  if (existsSync(join(repo, ".claude", "zeno.yaml")) && !answers.force) {
    throw new Error(`${repo} is already set up (.claude/zeno.yaml exists) — use --force to redo it`);
  }
  const kind = answers.kind ?? inferKind(repo);
  const modules = answers.modules ?? (answers.kind ? MODULES_BY_KIND[kind] : inferModules(repo, kind));
  const sdk = kind === "expo-app" ? detectExpoSdk(repo) : undefined;
  const config: InitPlan["config"] = { zeno: answers.zenoVersion, kind, modules, ...(sdk ? { expo: { sdk } } : {}) };

  const create = REQUIRED_CONTEXT.filter((name) => !existsSync(join(repo, ".context", name))).map((name) => FIRST_FILE[name]);
  return { config, create };
}

export function applyInit(repo: string, plan: InitPlan, options: { run: Runner; name: string; today?: string }): void {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const write = (file: string, content: string) => {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), content);
  };
  write(".claude/zeno.yaml", stringify(plan.config));
  for (const file of plan.create) write(file, template(file, today));

  if (!plan.config.modules.includes("knowledge")) return;
  for (const kind of ["wiki", "features"]) {
    options.run("qmd", ["collection", "add", join(repo, ".context", kind), "--name", `${options.name}-${kind}`]);
  }
}
