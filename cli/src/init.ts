import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stringify } from "yaml";
import { RULES_FILES } from "./checks/architecture.ts";
import { requiredContext } from "./checks/context-layout.ts";
import { inferKind, inferModules } from "./config/load.ts";
import { MODULES_BY_KIND, type Kind, type Module } from "./config/schema.ts";

export type Runner = (command: string, args: string[]) => void;

export interface InitAnswers {
  zenoVersion: string;
  kind?: Kind;
  modules?: Module[];
  packs?: string[];
  force?: boolean;
}

export interface InitPlan {
  config: { zeno: string; kind: Kind; modules: Module[]; expo?: { sdk: number }; packs?: string[] };
  /** Files under the repo that will be created; existing files are never touched. */
  create: string[];
}

export const ARCHITECTURE_BASE = ".dependency-cruiser.base.cjs";
const ARCHITECTURE_TEMPLATES = join("templates", "dependency-cruiser");
const WORKSPACE_PARENTS = ["apps", "packages"];

export interface Starter {
  file: string;
  template: "base.cjs" | "root.cjs" | "app.cjs" | "package.cjs";
}

/**
 * The rules files the architecture module needs: zeno's managed base, then a starter
 * per workspace (a folder under apps/ or packages/ with a package.json), or one at the
 * root when the repo has no workspaces.
 */
export function architectureStarters(repo: string): Starter[] {
  const workspaces = WORKSPACE_PARENTS.flatMap((parent) =>
    existsSync(join(repo, parent))
      ? readdirSync(join(repo, parent), { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && existsSync(join(repo, parent, entry.name, "package.json")))
          .map((entry) => `${parent}/${entry.name}`)
          .sort()
      : [],
  );
  const starters: Starter[] =
    workspaces.length > 0
      ? workspaces.map((dir) => ({ file: `${dir}/${RULES_FILES[0]}`, template: dir.startsWith("apps/") ? "app.cjs" : "package.cjs" }))
      : [{ file: RULES_FILES[0], template: "root.cjs" }];
  return [{ file: ARCHITECTURE_BASE, template: "base.cjs" }, ...starters];
}

/** Rewrites a repo's managed architecture base from zeno's template; true when it changed. */
export function refreshArchitectureBase(repo: string, zenoRoot: string): boolean {
  const file = join(repo, ARCHITECTURE_BASE);
  if (!existsSync(file)) return false;
  const current = readFileSync(join(zenoRoot, ARCHITECTURE_TEMPLATES, "base.cjs"), "utf8");
  if (readFileSync(file, "utf8") === current) return false;
  writeFileSync(file, current);
  return true;
}

/** Parses a `--modules`/`--packs` style comma list, rejecting anything not in `allowed`. */
export function parseChoices<T extends string>(value: string, allowed: readonly T[], label: string): T[] {
  const chosen = value.split(",").map((item) => item.trim()).filter(Boolean);
  const unknown = chosen.find((item) => !allowed.includes(item as T));
  if (unknown) throw new Error(`unknown ${label} "${unknown}" — choose from: ${allowed.join(", ")}`);
  return chosen as T[];
}

const PACKAGE_FILES =["package.json", "apps/mobile/package.json"];

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

function template(file: string): string {
  switch (file) {
    case ".context/README.md":
      return "# .context\n\nProduct material, in the ten folders of the zeno context layout.\n\n## Absent folders\n\n- listing/ — n/a — no store presence yet\n- marketing/, metrics/, support/, legal/ — n/a — not live yet\n- ops/ — n/a — nothing to run yet\n";
    case ".context/tasks.md":
      return "# Tasks\n\n## Now\n\n## Blocked\n\n## Waiting\n";
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
  const packs = answers.packs?.length ? { packs: answers.packs } : {};
  const config: InitPlan["config"] = { zeno: answers.zenoVersion, kind, modules, ...(sdk ? { expo: { sdk } } : {}), ...packs };

  const create = requiredContext(modules).filter((name) => !existsSync(join(repo, ".context", name))).map((name) => FIRST_FILE[name]);
  if (modules.includes("architecture")) {
    // A workspace that already has rules of its own (any name dependency-cruiser reads) keeps them.
    const taken = (file: string) =>
      file === ARCHITECTURE_BASE ? existsSync(join(repo, file)) : RULES_FILES.some((name) => existsSync(join(repo, dirname(file), name)));
    create.push(...architectureStarters(repo).map((s) => s.file).filter((file) => !taken(file)));
  }
  return { config, create };
}

export function applyInit(repo: string, plan: InitPlan, options: { run: Runner; name: string; zenoRoot: string }): void {
  const write = (file: string, content: string) => {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), content);
  };
  write(".claude/zeno.yaml", stringify(plan.config));
  const starters = new Map(architectureStarters(repo).map((s) => [s.file, s.template]));
  for (const file of plan.create) {
    const starter = starters.get(file);
    write(file, starter ? readFileSync(join(options.zenoRoot, ARCHITECTURE_TEMPLATES, starter), "utf8") : template(file));
  }

  if (plan.config.modules.includes("knowledge")) indexKnowledge(repo, options.name, options.run);
}

/** Adds the repo's wiki and features to qmd. Safe to repeat: qmd refuses a name it already has. */
export function indexKnowledge(repo: string, name: string, run: Runner): void {
  for (const kind of ["wiki", "features"]) {
    run("qmd", ["collection", "add", join(repo, ".context", kind), "--name", `${name}-${kind}`]);
  }
}
