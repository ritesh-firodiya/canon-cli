import { z } from "zod";

/** What a repo ships: an app to the stores, a site to the web, both, a package to a registry, or no code at all. */
export const KINDS = ["mobile", "web", "mobile-and-web", "package", "content"] as const;
export const MODULES = ["docs", "design", "knowledge", "metrics", "code", "architecture", "listing", "refs"] as const;

/**
 * The wiki page types every repo has, and the folder each lives in. A repo adds more under `wiki.types`.
 * No flow type: a journey worth keeping is a concept. A surface page is a screen's notes, only where it has real ones.
 */
export const WIKI_FOLDER_BY_TYPE: Record<string, string> = {
  concept: "concepts",
  entity: "entities",
  surface: "surfaces",
  decision: "decisions",
  synthesis: "synthesis",
};
/** Wiki folders that no longer exist, and what to do with what was in them. */
export const REMOVED_WIKI_FOLDERS: Record<string, string> = {
  flows: "fold a journey worth keeping into a concept page",
};
/** Where a repo keeps its config, and the uncommitted override beside it. */
export const CONFIG_FILE = ".context/context.yaml";
export const LOCAL_CONFIG_FILE = ".context/context.local.yaml";

/** One kind of numbered record, in its own `.context/` folder. */
export interface RecordKind {
  folder: string;
  prefix: string;
  statuses: string[];
  /** Frontmatter fields every record of this kind must have; a list limits the values. */
  fields: Record<string, string[] | null>;
  sections: string[];
}

/** The default records. A repo adds, changes or removes kinds under `records`. */
export const DEFAULT_RECORDS: RecordKind[] = [
  { folder: "problems", prefix: "PROB", statuses: ["open", "solving", "solved", "dismissed"], fields: { source: null, priority: ["p0", "p1", "p2", "p3"] }, sections: ["Summary", "Impact", "Expected"] },
  { folder: "ideas", prefix: "IDEA", statuses: ["draft", "accepted", "shipped", "dropped"], fields: {}, sections: ["Summary"] },
  { folder: "experiments", prefix: "EXP", statuses: ["planned", "running", "done", "dropped"], fields: { kind: ["poc", "experiment"] }, sections: ["Summary"] },
  { folder: "plans", prefix: "PLAN", statuses: ["draft", "approved", "building", "done", "dropped"], fields: { problem: null }, sections: ["Approach", "Steps"] },
  { folder: "features", prefix: "FEAT", statuses: ["planned", "building", "shipped", "shelved", "superseded"], fields: { type: ["feature", "chore", "platform"] }, sections: [] },
  { folder: "bugs", prefix: "BUG", statuses: ["open", "fixing", "fixed", "wontfix"], fields: { severity: ["low", "medium", "high", "critical"] }, sections: ["Summary", "Expected", "Actual"] },
];

/** The other `.context/` folders every repo may have. A repo adds more under `context.folders`. */
export const CONTEXT_FOLDERS = ["raw", "wiki", "designs", "listing", "marketing", "metrics", "support", "legal", "ops", "architecture"];

/** A `standards:` entry naming a library standard rather than a folder path. */
export function isStandardName(entry: string): boolean {
  return /^[a-z0-9-]+$/.test(entry);
}

export type Kind = (typeof KINDS)[number];
export type Module = (typeof MODULES)[number];

const principleId = z.string().regex(/^C-\d{2}$/, "principle IDs look like C-07");

const command = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    /** Shell command run from the repo root; a non-zero exit is an error finding. */
    run: z.string().min(1),
    /** Only run when this path exists in the repo. */
    if: z.string().optional(),
    /** Only run in a repo that uses this module. */
    module: z.enum(MODULES).optional(),
    /** Only run in a repo of one of these kinds. */
    kinds: z.array(z.enum(KINDS)).optional(),
  })
  .strict();

const kebab = z.string().regex(/^[a-z0-9-]+$/, "use lowercase-kebab");
/** An addition to canon's layout says why, so products drifting apart is written down. */
const reason = z.string().min(1);

const wikiType = z
  .object({
    type: kebab,
    folder: kebab,
    reason,
    /** The `## ` headings every page of this type must have, as the schema lists them for the built-in six. */
    sections: z.array(z.string().min(1)).min(1, "list the `## ` sections every page of this type must have"),
  })
  .strict()
  .refine((entry) => !(entry.type in WIKI_FOLDER_BY_TYPE) && !Object.values(WIKI_FOLDER_BY_TYPE).includes(entry.folder), {
    message: "a built-in wiki type or its folder cannot be redefined — add a new one",
  });

const contextFolder = z.object({ folder: kebab, reason }).strict();

/** A file copied from the source repo: the same path on both sides, or `from` one path `to` another. */
const copyFile = z.union([
  z.string().min(1),
  z
    .object({
      from: z.string().min(1),
      to: z.string().min(1).optional(),
      /** Identical except that the source product's name reads as this product's. */
      named: z.boolean().optional(),
      /** Compared only above the first line containing this text; below it is the product's own. */
      until: z.string().min(1).optional(),
    })
    .strict(),
]);

const stage = z
  .object({
    id: kebab,
    /** Paths that show the stage has started, for `canon pipeline` and `canon flow`; any one is enough. */
    done: z.array(z.string().min(1)).default([]),
    /** A person must approve this stage on the record (`canon approve <id> --record <id>`) before any later stage runs. */
    gate: z.boolean().default(false),
    /** Who does the work; a person when absent. */
    by: z.enum(["person", "agent"]).optional(),
    /** A stage the run may skip. `when` says in words when it is needed. */
    optional: z.boolean().optional(),
    when: z.string().min(1).optional(),
    /** The most this stage may spend per run, in US dollars. Falls back to the top-level `cap`. */
    cap: z.number().positive().optional(),
    /** What the agent is told to do at this stage. */
    prompt: z.string().min(1).optional(),
    /** The model for this stage: the smallest one that does the job well. */
    model: z.string().min(1).optional(),
    /** The tools an agent may use here. Absent: read and write files in the repo, with no shell. */
    tools: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .refine((entry) => !entry.when || entry.optional, { message: "a stage with `when` must be `optional: true`" });

/** Sources that open a Problem with no connector behind them. */
export const BUILT_IN_TRIGGER_SOURCES = ["manual", "schedule"];

/** A way to read a team's own tool, reached the lightest way that works. Always read-only. */
const connector = z
  .object({
    id: kebab,
    via: z.enum(["tool", "cli", "api", "mcp"]),
    /** The command, URL or server name, for a tool canon has no built-in way to reach. */
    target: z.string().min(1).optional(),
    /** The names of the environment variables holding its keys. Never the keys. */
    env: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/, "env lists variable names, like ACME_TOKEN, never their values")).optional(),
  })
  .strict();

/** A change to the default records: a new kind, new values for a default one, or `remove: true`. */
const recordEntry = z
  .object({
    folder: kebab,
    prefix: z.string().regex(/^[A-Z]+$/, "a prefix is capital letters, like CAMP").optional(),
    statuses: z.array(z.string().min(1)).min(1).optional(),
    fields: z.record(z.string(), z.array(z.string()).nullable()).optional(),
    sections: z.array(z.string().min(1)).optional(),
    remove: z.boolean().optional(),
  })
  .strict();

/** What opens a Problem by itself. `source` is a connector's id or a built-in source. */
const trigger = z
  .object({
    id: kebab,
    source: kebab,
    when: z.string().min(1),
    /** The most one trigger run may spend on the work it starts, in US dollars. */
    cap: z.number().positive().optional(),
    /** The named pipeline its problems follow. */
    pipeline: kebab.optional(),
    priority: z.enum(["p0", "p1", "p2", "p3"]).optional(),
  })
  .strict();

const tool = z.object({ tool: z.string(), why: z.string(), hint: z.string() }).strict();

/** One layer of `.context/context.yaml` as written: every field optional. */
export const layerSchema = z
  .object({
    canon: z.string(),
    kind: z.enum(KINDS),
    modules: z.array(z.enum(MODULES)),
    expo: z.object({ sdk: z.number().int().positive() }).partial(),
    packs: z.array(z.string().regex(/^[a-z0-9-]+$/, "pack names are lowercase-kebab")),
    /** Standards to add: a bare name imports canon's library standard (`design-sets`); a path (`./rules`) is a folder of the repo's own. */
    standards: z.array(z.string()),
    commands: z.array(command),
    doctor: z.object({ tools: z.array(tool) }).partial(),
    weigh: z.object({ weights: z.record(principleId, z.number().nonnegative()) }).partial(),
    wiki: z.object({ types: z.array(wikiType) }).partial(),
    context: z.object({ folders: z.array(contextFolder) }).partial(),
    /** Named pipelines. A more specific layer replaces a pipeline of the same name and keeps the others. */
    pipelines: z.record(kebab, z.array(stage)),
    /** The default spend cap per stage, in US dollars. */
    cap: z.number().positive(),
    /** The layers this one builds on, furthest first: an organization's rules, a product's, a team's. Paths are relative to this file. */
    extends: z.array(z.string().min(1)),
    /** Values lower layers may not change: `cap`, `pipelines.default.review`, `records.bugs`, `connectors.sentry`. */
    locked: z.array(z.string().min(1)),
    connectors: z.array(connector),
    triggers: z.array(trigger),
    records: z.array(recordEntry),
    /** How the product is written in prose, for files shared with only the name changed. */
    name: z.string().min(1),
    /** The repo's older folder names, so `canon flow` still counts conversations held under them. */
    formerly: z.array(z.string().min(1)),
    /** The product this repo is part of. Repos naming the same product act as one; a repo without it is a product of its own. */
    product: kebab,
    /** The team that owns this repo's work. */
    team: kebab,
    /**
     * Files copied from one source repo. The source names sets of them in its own context.yaml; a
     * product names the source and lists the sets it uses, and only those are held equal to it.
     */
    copies: z.object({ source: z.string().min(1), sets: z.record(kebab, z.array(copyFile).min(1)), use: z.array(kebab) }).partial().strict(),
  })
  .partial()
  .strict();

export type Layer = z.infer<typeof layerSchema>;
export type CommandSpec = z.infer<typeof command>;
export type ToolSpec = z.infer<typeof tool>;
export type WikiTypeSpec = z.infer<typeof wikiType>;
export type ContextFolderSpec = z.infer<typeof contextFolder>;
export type StageSpec = z.infer<typeof stage>;
export type ConnectorSpec = z.infer<typeof connector>;
export type TriggerSpec = z.infer<typeof trigger>;
export type RecordEntry = z.infer<typeof recordEntry>;
export type CopyFileSpec = z.infer<typeof copyFile>;

export interface Config {
  /** The canon version this repo was last synced to. */
  canon?: string;
  kind: Kind;
  modules: Module[];
  expo?: { sdk?: number };
  packs: string[];
  /** Library standard names and absolute folders; a later file of the same name wins. */
  standards: string[];
  commands: CommandSpec[];
  doctor: { tools: ToolSpec[] };
  weigh: { weights: Record<string, number> };
  /** Wiki page types added to the built-in six. */
  wiki: { types: WikiTypeSpec[] };
  /** `.context/` folders added to the built-in ten. */
  context: { folders: ContextFolderSpec[] };
  /** Ordered stages by name. `default` is canon's flow unless a layer sets its own. */
  pipelines: Record<string, StageSpec[]>;
  cap?: number;
  /** What each layer locked, with the value it locked and where. */
  locks: { key: string; value: unknown; layer: string }[];
  connectors: ConnectorSpec[];
  triggers: TriggerSpec[];
  /** The record kinds this repo uses: the defaults with its changes applied. */
  records: RecordKind[];
  name?: string;
  /** The product this repo is part of; unset means the repo is its own. */
  product?: string;
  team?: string;
  /** Older folder names of the repo. */
  formerly: string[];
  /** `source` is absolute, resolved from the layer that set it. `use` adds up across layers. */
  copies: { source?: string; sets: Record<string, CopyFileSpec[]>; use: string[] };
}

export const MODULES_BY_KIND: Record<Kind, Module[]> = {
  mobile: ["docs", "knowledge", "code", "listing", "refs"],
  web: ["docs", "knowledge", "code", "refs"],
  "mobile-and-web": ["docs", "knowledge", "code", "listing", "refs"],
  // A package's docs describe other repos' .context/ paths, so refs would flag them.
  package: ["docs", "knowledge", "code"],
  content: ["docs", "knowledge", "refs"],
};

/** A repo that ships both counts as mobile and as web: it gets both kinds' packs. */
export function kindCovers(kind: Kind, wanted: Kind): boolean {
  return kind === wanted || (kind === "mobile-and-web" && (wanted === "mobile" || wanted === "web"));
}
