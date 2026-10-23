import type { Config, Module } from "../config/schema.ts";

export type Level = "error" | "warn";

export interface Finding {
  check: string;
  level: Level;
  message: string;
  file?: string;
}

export interface CheckContext {
  repo: string;
  name: string;
  config: Config;
  /** Root of the zeno repo, where standards/ and skills/ live. */
  zenoRoot: string;
  today: Date;
}

export interface Check {
  id: string;
  /** The module that must be enabled for this check to run; null = always. */
  module: Module | null;
  description: string;
  run(context: CheckContext): Finding[];
}
