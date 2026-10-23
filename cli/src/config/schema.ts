import { z } from "zod";

export const KINDS = ["expo-app", "web", "content"] as const;
export const MODULES = ["docs", "design", "knowledge", "metrics", "code", "architecture", "listing"] as const;

/** The wiki page types every repo has, and the folder each lives in. A repo adds more under `wiki.types`. */
export const WIKI_FOLDER_BY_TYPE: Record<string, string> = {
  concept: "concepts",
  entity: "entities",
  surface: "surfaces",
  flow: "flows",
  decision: "decisions",
  synthesis: "synthesis",
};
/** The `.context/` folders every repo may have. A repo adds more under `context.folders`. */
export const CONTEXT_FOLDERS = ["raw", "wiki", "features", "designs", "listing", "marketing", "metrics", "support", "legal", "ops"];

export type Kind = (typeof KINDS)[number];
export type Module = (typeof MODULES)[number];

const checkOverride = z
  .object({ enabled: z.boolean().default(true), reason: z.string().min(1).optional() })
  .refine((check) => check.enabled || check.reason !== undefined, {
    message: "a check turned off needs a `reason:` — an override nobody can explain is drift",
  });

const principleId = z.string().regex(/^C-\d{2}$/, "principle IDs look like C-07");

const command = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    /** Shell command run from the repo root; a non-zero exit is an error finding. */
    run: z.string().min(1),
    /** Only run when this path exists in the repo. */
    if: z.string().optional(),
  })
  .strict();

const kebab = z.string().regex(/^[a-z0-9-]+$/, "use lowercase-kebab");
/** An addition to zeno's layout says why, so products drifting apart is written down. */
const reason = z.string().min(1);

const wikiType = z
  .object({ type: kebab, folder: kebab, reason })
  .strict()
  .refine((entry) => !(entry.type in WIKI_FOLDER_BY_TYPE) && !Object.values(WIKI_FOLDER_BY_TYPE).includes(entry.folder), {
    message: "a built-in wiki type or its folder cannot be redefined — add a new one",
  });

const contextFolder = z.object({ folder: kebab, reason }).strict();

const tool = z.object({ tool: z.string(), why: z.string(), hint: z.string() }).strict();

/** One layer of `.claude/zeno.yaml` as written: every field optional. */
export const layerSchema = z
  .object({
    /** Marks the folder holding this file as an estate: the parent of several products. */
    estate: z.boolean(),
    zeno: z.string(),
    kind: z.enum(KINDS),
    modules: z.array(z.enum(MODULES)),
    expo: z.object({ sdk: z.number().int().positive() }).partial(),
    packs: z.array(z.string().regex(/^[a-z0-9-]+$/, "pack names are lowercase-kebab")),
    /** Folders of extra standards, relative to the folder that holds `.claude/`. */
    standards: z.array(z.string()),
    commands: z.array(command),
    doctor: z.object({ tools: z.array(tool) }).partial(),
    checks: z.record(z.string(), checkOverride),
    weigh: z.object({ weights: z.record(principleId, z.number().nonnegative()) }).partial(),
    wiki: z.object({ types: z.array(wikiType) }).partial(),
    context: z.object({ folders: z.array(contextFolder) }).partial(),
  })
  .partial()
  .strict();

export type Layer = z.infer<typeof layerSchema>;
export type CommandSpec = z.infer<typeof command>;
export type ToolSpec = z.infer<typeof tool>;
export type WikiTypeSpec = z.infer<typeof wikiType>;
export type ContextFolderSpec = z.infer<typeof contextFolder>;

export interface Config {
  /** The zeno version this repo was last synced to. */
  zeno?: string;
  kind: Kind;
  modules: Module[];
  expo?: { sdk?: number };
  packs: string[];
  /** Absolute standards folders, estate first; a later file of the same name wins. */
  standards: string[];
  commands: CommandSpec[];
  doctor: { tools: ToolSpec[] };
  checks: Record<string, { enabled: boolean; reason?: string }>;
  weigh: { weights: Record<string, number> };
  /** Wiki page types added to the built-in six. */
  wiki: { types: WikiTypeSpec[] };
  /** `.context/` folders added to the built-in ten. */
  context: { folders: ContextFolderSpec[] };
}

export const MODULES_BY_KIND: Record<Kind, Module[]> = {
  "expo-app": ["docs", "knowledge", "code", "listing"],
  web: ["docs", "knowledge", "code"],
  content: ["docs", "knowledge"],
};
