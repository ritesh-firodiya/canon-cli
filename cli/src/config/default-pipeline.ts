import type { StageSpec } from "./schema.ts";

const FILES_AND_SHELL = ["Read", "Glob", "Grep", "Edit", "Write", "Bash"];

const agent = (id: string, done: string[], prompt: string, more: Partial<StageSpec> = {}): StageSpec => ({ id, done, gate: false, by: "agent", prompt, ...more });

/** Problem, idea and discovery fork from intake: any of them, in any order, or none. The run asks each one's `when`. */
const FORK = ["intake", "problem", "idea", "discovery"];
const fork = (id: string, when: string) => ({ after: FORK.filter((other) => other !== id), optional: true, when });

/** Canon's flow when a repo sets none of its own. `canon init` writes it to context.yaml, to change at will. */
export const DEFAULT_PIPELINE: StageSpec[] = [
  agent("intake", [], "Read the signals behind this work: the record, its source: and sources:, and what they link to. A signal is a user, an email, an error, a bug report or a metric. Check each one is true against what you can reach, and say which you could not check. Link the record to any open problem, idea or discovery it repeats, instead of writing a new one."),
  agent("problem", [".context/problems"], "Write what is wrong as a problem in .context/problems: who it hurts, how much, and what should be true instead. Link the ideas and discoveries it came from.", fork("problem", "something is wrong that no open problem already says")),
  agent("idea", [".context/ideas"], "Write the proposed change as an idea in .context/ideas, naming the problems it would solve and the discoveries behind it.", fork("idea", "a change is proposed that no open idea already says")),
  agent("discovery", [".context/wiki/synthesis"], "Write what was learned as a discovery in .context/wiki/synthesis/<topic>.md, with last-verified in its frontmatter and the evidence it rests on. Counts and rates only, never rows that name a person.", fork("discovery", "something new was learned: data, user behavior or a market fact")),
  agent("research", [".context/raw", ".context/wiki/synthesis"], "Find what is already known: search the wiki, past outcomes and other evidence for how this was solved before. Put each finding in .context/wiki/synthesis/<topic>.md, with last-verified in its frontmatter, and dated data in .context/raw/. Counts and rates only, never rows that name a person.", { after: FORK }),
  agent("options", [".context/ideas"], "Using the findings, write each way to solve the problem as an idea in .context/ideas, naming the problem under problems: and the evidence behind it. These are options, not yet chosen."),
  agent("design", [".context/designs"], "Draw only the screens that change, as HTML in .context/designs, one per option still in the running.", { optional: true, when: "a screen changes", gate: true }),
  agent("plan", [".context/plans"], "Weigh the options against the findings and the designs with the weigh skill. Write the best one as a plan in .context/plans with its Approach and Steps, and say why the others lost.", { gate: true }),
  agent("feature", [".context/features", ".context/bugs"], "Split the approved plan into small pieces in .context/features or .context/bugs, each naming the plan."),
  agent("code", ["apps", "src", "app", "packages"], "Write the code and its tests for each piece, using everything above. Open a pull request naming the piece.", { tools: FILES_AND_SHELL, changes: true }),
  agent("review", [".github"], "Check the pull request for correctness, consistency and security. Run canon check and the tests. Fix what you find and report the rest.", { gate: true, tools: FILES_AND_SHELL }),
  { id: "release", done: [".context/ops/release.yml"], gate: false, by: "person" },
  agent("outcome", [], "Read the numbers that show whether this worked. Save a dated snapshot of counts and rates in .context/raw/. Set outcome: retained, discarded or retried, and write what happened under ## Result."),
];
