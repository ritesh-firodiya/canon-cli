import type { Config } from "../../config/schema.ts";
import { stagesAfter } from "../pipeline/graph.ts";
import { pipelineOf } from "../pipeline/pipeline.ts";
import { newPage } from "./new.ts";

/** Starts a named experiment at any stage. Its run and checks begin there: what comes before is not its work. */
export function startExperiment(repo: string, config: Config, name: string, options: { from: string; to?: string; pipeline?: string; fields?: Record<string, string> }): { id: string; file: string } {
  const pipeline = options.pipeline ?? "default";
  const stages = pipelineOf(config, pipeline);
  const ids = stages.map((stage) => stage.id);
  if (!ids.includes(options.from)) throw new Error(`no stage "${options.from}" in ${pipeline}: ${ids.join(", ")}`);
  if (options.to && options.to !== options.from && !stagesAfter(stages, options.from).has(options.to)) throw new Error(`"${options.to}" does not come after "${options.from}" in ${pipeline}`);
  return newPage(repo, config, "experiments", name, { ...options.fields, status: "running", "started-at": options.from, ...(options.to ? { "stops-at": options.to } : {}), ...(pipeline === "default" ? {} : { pipeline }) });
}
