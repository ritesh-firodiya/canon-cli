import { z } from "zod";

export const KINDS = ["expo-app", "web", "content"] as const;
export const MODULES = ["docs", "design", "knowledge", "specs", "metrics", "code", "architecture", "listing"] as const;

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
  })
  .partial()
  .strict();

export type Layer = z.infer<typeof layerSchema>;
export type CommandSpec = z.infer<typeof command>;
export type ToolSpec = z.infer<typeof tool>;

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
}

export const MODULES_BY_KIND: Record<Kind, Module[]> = {
  "expo-app": ["docs", "design", "knowledge", "metrics", "code", "listing"],
  web: ["docs", "design", "knowledge", "metrics", "code"],
  content: ["docs", "knowledge"],
};
