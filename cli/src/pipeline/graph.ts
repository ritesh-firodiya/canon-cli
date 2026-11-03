import type { StageSpec } from "../config/schema.ts";

/** The stages a stage may follow: its `after`, or else the one before it in the list. */
export function afterOf(stages: StageSpec[], stage: StageSpec): string[] {
  const index = stages.indexOf(stage);
  return stage.after ?? (index > 0 ? [stages[index - 1].id] : []);
}

function walk(start: string, next: (id: string) => string[]): Set<string> {
  const seen = new Set<string>();
  let queue = [...next(start)];
  while (queue.length) {
    const [id, ...rest] = queue;
    queue = seen.has(id) ? rest : [...rest, ...next(id)];
    seen.add(id);
  }
  // A fork may lead back to where it began; a stage is never before or after itself.
  seen.delete(start);
  return seen;
}

/** Every stage that can lead to `id`. */
export function stagesBefore(stages: StageSpec[], id: string): Set<string> {
  return walk(id, (each) => {
    const stage = stages.find((entry) => entry.id === each);
    return stage ? afterOf(stages, stage) : [];
  });
}

/** Every stage `id` can lead to. */
export function stagesAfter(stages: StageSpec[], id: string): Set<string> {
  return walk(id, (each) => stages.filter((stage) => afterOf(stages, stage).includes(each)).map((stage) => stage.id));
}

/** Why a pipeline's `after` lists cannot work, or null when they can. */
export function afterProblem(stages: StageSpec[]): string | null {
  const ids = stages.map((stage) => stage.id);
  for (const stage of stages) {
    const unknown = (stage.after ?? []).filter((id) => !ids.includes(id));
    if (unknown.length) return `stage "${stage.id}" comes after ${unknown.join(", ")}, which is not in this pipeline`;
    if (stage.after?.includes(stage.id)) return `stage "${stage.id}" cannot come after itself`;
  }
  if (!stages.length) return null;
  const reached = stagesAfter(stages, stages[0].id);
  const stranded = stages.slice(1).filter((stage) => !reached.has(stage.id));
  return stranded.length ? `no path from "${stages[0].id}" reaches ${stranded.map((stage) => stage.id).join(", ")}` : null;
}
