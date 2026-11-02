import type { StageSpec } from "./schema.ts";

const FILES_AND_SHELL = ["Read", "Glob", "Grep", "Edit", "Write", "Bash"];

const agent = (id: string, done: string[], prompt: string, more: Partial<StageSpec> = {}): StageSpec => ({ id, done, gate: false, by: "agent", prompt, ...more });

/** Canon's flow when a repo sets none of its own. `canon init` writes it to context.yaml, to change at will. */
export const DEFAULT_PIPELINE: StageSpec[] = [
  { id: "problem", done: [".context/problems"], gate: false },
  agent("research", [".context/raw", ".context/wiki/synthesis"], "Find what is known about the problem: search the wiki, past outcomes and other evidence for how it was solved before. Put each discovery or finding in .context/wiki/synthesis/<topic>.md, with last-verified in its frontmatter, and dated data in .context/raw/. Counts and rates only, never rows that name a person."),
  agent("idea", [".context/ideas"], "Using the findings, write each way to solve the problem in .context/ideas, naming the problem under problems: and the evidence behind it."),
  agent("plan", [".context/plans"], "Weigh the ideas against the knowledge and findings with the weigh skill. Write the best one as a plan in .context/plans with its Approach and Steps, and say why the others lost.", { gate: true }),
  agent("feature", [".context/features", ".context/bugs"], "Split the approved plan into small pieces in .context/features or .context/bugs, each naming the plan."),
  agent("design", [".context/designs"], "Draw only what changes, as HTML in .context/designs.", { optional: true, when: "a screen changes", gate: true }),
  agent("code", ["apps", "src", "app", "packages"], "Write the code and its tests for each piece, using everything above. Open a pull request naming the piece.", { tools: FILES_AND_SHELL, changes: true }),
  agent("review", [".github"], "Check the pull request for correctness, consistency and security. Run canon check and the tests. Fix what you find and report the rest.", { gate: true, tools: FILES_AND_SHELL }),
  { id: "release", done: [".context/ops/release.yml"], gate: false, by: "person" },
  agent("result", [], "Read the numbers that show whether this worked. Save a dated snapshot of counts and rates in .context/raw/. Set outcome: retained, discarded or retried, and write what happened under ## Result."),
];
