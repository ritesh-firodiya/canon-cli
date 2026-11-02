import type { StageSpec } from "./schema.ts";

const FILES_AND_SHELL = ["Read", "Glob", "Grep", "Edit", "Write", "Bash"];

const agent = (id: string, done: string[], prompt: string, more: Partial<StageSpec> = {}): StageSpec => ({ id, done, gate: false, by: "agent", prompt, ...more });

/** Canon's flow when a repo sets none of its own. `canon init` writes it to context.yaml, to change at will. */
export const DEFAULT_PIPELINE: StageSpec[] = [
  agent("idea", [".context/ideas"], "Search the wiki and past outcomes for how this was solved before. Write each way to solve it in .context/ideas, naming the problem under problems:. Put what you discovered in wiki/synthesis."),
  agent("poc", [".context/experiments"], "Build the smallest working proof of the riskiest idea. Record it in .context/experiments with kind: poc, its Hypothesis and its Result.", { optional: true, when: "the best idea is risky or unproven" }),
  agent("plan", [".context/plans"], "Weigh the ideas against the knowledge and findings with the weigh skill. Write the best one as a plan in .context/plans with its Approach and Steps, and say why the others lost.", { gate: true }),
  agent("feature", [".context/features", ".context/bugs"], "Split the approved plan into small pieces in .context/features or .context/bugs, each naming the plan. Mark a piece that goes live as a test with experiment: true, a Hypothesis and a Metric."),
  agent("design", [".context/designs"], "Draw only what changes, as HTML in .context/designs.", { optional: true, when: "a screen changes", gate: true }),
  agent("development", ["apps", "src", "app", "packages"], "Write the code and its tests for each piece, using everything above. Open a pull request naming the piece.", { tools: FILES_AND_SHELL }),
  agent("review", [".github"], "Check the pull request for correctness, consistency and security. Run canon check and the tests. Fix what you find and report the rest.", { gate: true, tools: FILES_AND_SHELL }),
  { id: "release", done: [".context/ops/release.yml"], gate: false, by: "person" },
  agent("result", [".context/raw"], "Read the numbers named under Metric. Save a dated snapshot of counts and rates in raw/. Set outcome: retained, discarded or retried, and write what happened under ## Result."),
];
