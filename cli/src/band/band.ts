import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { runChecks } from "../checks/check.ts";
import type { Config } from "../config/schema.ts";
import { loadConfig } from "../config/load.ts";
import { stagesOf } from "../pipeline/pipeline.ts";
import { queueOf, type QueueRow } from "../records/queue.ts";
import { allRecords } from "../records/records.ts";
import { DEFAULT_CAP_USD } from "../run/run.ts";
import { readRunning } from "../run/running.ts";

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
  stage: string | null;
  stages: { id: string; state: StageMark }[];
  waiting: { record: string; stage: string } | null;
  running: { record: string; stage: string | null; startedAt: string; spendUsd: number; capUsd: number } | null;
  problem: BandProblem | null;
  errors: { file?: string; message: string }[];
  warnings: { file?: string; message: string }[];
}

const NOTHING: Omit<BandFacts, "product"> = { stage: null, stages: [], waiting: null, running: null, problem: null, errors: [], warnings: [] };

function productRoot(start: string): string | null {
  let folder = resolve(start);
  while (!existsSync(join(folder, ".context"))) {
    if (dirname(folder) === folder) return null;
    folder = dirname(folder);
  }
  return folder;
}

const titleOf = (body: string, id: string): string => /^# (.+)$/m.exec(body)?.[1]?.trim() ?? id;

function problemOf(repo: string, config: Config, id: string | undefined): BandProblem | null {
  const record = id ? allRecords(repo, config).find((entry) => entry.id === id) : undefined;
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

function markStages(repo: string, config: Config, current: QueueRow | undefined, running: BandFacts["running"]): Pick<BandFacts, "stage" | "stages"> {
  const stages = stagesOf(repo, config);
  const started = stages.filter((stage) => stage.startedAt).at(-1)?.id ?? null;
  const stage = running?.stage ?? current?.stage ?? started;
  const at = stages.findIndex((entry) => entry.id === stage);
  const here: StageMark = running ? "running" : current?.waiting ? "waiting" : "here";
  return {
    stage,
    stages: stages.map((entry, index) => ({ id: entry.id, state: index === at ? here : index < at ? "ok" : "todo" })),
  };
}

/** Everything the band above the prompt shows about the work. It only reads, and approves nothing. */
export function buildBand(start: string, options: { canonRoot: string }): BandFacts {
  const repo = productRoot(start);
  if (!repo) return { product: null, ...NOTHING };
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
    return { product, ...NOTHING, errors: errors.length ? errors : [{ message: (error as Error).message }], warnings };
  }
  const queue = queueOf(repo, config);
  const current = queue.find((row) => row.waiting) ?? queue.find((row) => row.stage);
  const running = runningFacts(repo, config);
  return {
    product,
    ...markStages(repo, config, current, running),
    waiting: current?.waiting ? { record: current.id, stage: current.waiting } : null,
    running,
    problem: problemOf(repo, config, running?.record ?? current?.id),
    errors,
    warnings,
  };
}
