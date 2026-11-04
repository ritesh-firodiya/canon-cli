import { basename } from "node:path";
import { productRoot } from "../../lib/files.ts";

export { productRoot };
import { runChecks } from "../../enforce/checks/check.ts";
import type { Config, Feature } from "../../config/schema.ts";
import { loadConfig } from "../../config/load.ts";
import { readUserFeatures } from "../../setup/features/features.ts";
import { queueOf } from "../../work/records/queue.ts";
import { allRecords, type WorkRecord } from "../../work/records/records.ts";
import { DEFAULT_CAP_USD } from "../../work/run/run.ts";
import { readRunning } from "../../work/run/running.ts";
import { stageOfRecord } from "../../work/pipeline/pipeline.ts";

export type StageMark = "ok" | "here" | "waiting" | "running" | "todo";

export interface BandProblem {
  id: string;
  title: string;
  source: string | null;
  priority: string | null;
  file: string;
}

export interface BandFacts {
  product: string | null;
  root: string | null;
  stage: string | null;
  stages: { id: string; state: StageMark }[];
  waiting: { record: string; stage: string } | null;
  running: { record: string; stage: string | null; startedAt: string; spendUsd: number; capUsd: number } | null;
  problem: BandProblem | null;
  errors: { file?: string; message: string }[];
  warnings: { file?: string; message: string }[];
  features: Feature[];
}

const NOTHING: Omit<BandFacts, "product"> = { root: null, stage: null, stages: [], waiting: null, running: null, problem: null, errors: [], warnings: [], features: [] };

const titleOf = (body: string, id: string): string => /^# (.+)$/m.exec(body)?.[1]?.trim() ?? id;

function problemOf(record: WorkRecord | undefined): BandProblem | null {
  if (!record) return null;
  const text = (value: unknown) => (value === undefined || value === null ? null : String(value));
  return { id: record.id, title: titleOf(record.body, record.id), source: text(record.data.source), priority: text(record.data.priority), file: record.file };
}

function runningFacts(repo: string, config: Config): BandFacts["running"] {
  const mark = readRunning(repo);
  if (!mark) return null;
  const data = allRecords(repo, config).find((entry) => entry.id === mark.record)?.data ?? {};
  return { record: mark.record, stage: data.stage ? String(data.stage) : null, startedAt: mark.startedAt, spendUsd: Number(data.cost ?? 0), capUsd: config.cap ?? DEFAULT_CAP_USD };
}

/** Where the record in focus stands. A folder that exists says nothing about the work, so no record means no stage. */
function markStages(config: Config, record: WorkRecord | undefined, here: StageMark): Pick<BandFacts, "stage" | "stages"> {
  const stages = config.pipelines[String(record?.data.pipeline ?? "default")] ?? [];
  const stage = record ? stageOfRecord(config, record) : null;
  const at = stages.findIndex((entry) => entry.id === stage);
  return {
    stage,
    stages: stages.map((entry, index) => ({ id: entry.id, state: index === at ? here : index < at ? "ok" : "todo" })),
  };
}

/** Everything the band above the prompt shows about the work. It only reads, and approves nothing. */
export function buildBand(start: string, options: { canonRoot: string }): BandFacts {
  const repo = productRoot(start);
  const onMachine = readUserFeatures();
  if (!repo) return { product: null, ...NOTHING, features: onMachine };
  const product = basename(repo);
  const findings = runChecks(repo, options).findings;
  const pick = (level: string) => findings.filter((finding) => finding.level === level).map(({ file, message }) => ({ ...(file ? { file } : {}), message }));
  const errors = pick("error");
  const warnings = pick("warn");
  let config: Config;
  try {
    config = loadConfig(repo).config;
  } catch (error) {
    // runChecks reports a bad config too; the band still has to draw.
    return { product, ...NOTHING, errors: errors.length ? errors : [{ message: (error as Error).message }], warnings, features: onMachine };
  }
  const queue = queueOf(repo, config);
  const records = allRecords(repo, config);
  // No pointer to keep fresh: the work in focus is what a run is on, else what waits for a person, else the first under way.
  const current = queue.find((row) => row.waiting) ?? queue.find((row) => row.stage);
  const running = runningFacts(repo, config);
  const focus = records.find((record) => record.id === (running?.record ?? current?.id));
  const here: StageMark = running ? "running" : current?.waiting ? "waiting" : "here";
  return {
    product,
    root: repo,
    ...markStages(config, focus, here),
    waiting: current?.waiting ? { record: current.id, stage: current.waiting } : null,
    running,
    problem: problemOf(focus),
    errors,
    warnings,
    features: [...new Set([...config.features, ...onMachine])],
  };
}
