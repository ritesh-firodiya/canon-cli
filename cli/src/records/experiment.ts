import type { Config } from "../config/schema.ts";
import { pipelineOf } from "../pipeline/pipeline.ts";
import { newPage } from "./new.ts";
import { setFields } from "./records.ts";

/** Starts a named experiment at any stage. What comes before it is recorded as skipped, with the reason. */
export function startExperiment(repo: string, config: Config, name: string, options: { from: string; to?: string; pipeline?: string }): { id: string; file: string } {
  const pipeline = options.pipeline ?? "default";
  const ids = pipelineOf(config, pipeline).map((stage) => stage.id);
  const from = ids.indexOf(options.from);
  if (from < 0) throw new Error(`no stage "${options.from}" in ${pipeline}: ${ids.join(", ")}`);
  if (options.to && ids.indexOf(options.to) < from) throw new Error(`"${options.to}" does not come after "${options.from}" in ${pipeline}`);
  const page = newPage(repo, config, "experiments", name, { status: "running", "started-at": options.from, ...(options.to ? { "stops-at": options.to } : {}), ...(pipeline === "default" ? {} : { pipeline }) });
  setFields(repo, page.file, { skipped: ids.slice(0, from).filter((id) => id !== "problem").map((stage) => ({ stage, reason: `the experiment starts at ${options.from}` })) });
  return page;
}
