import type { StageSpec } from "./schema.ts";

const FILES_AND_SHELL = ["Read", "Glob", "Grep", "Edit", "Write", "Bash"];

const agent = (id: string, done: string[], prompt: string, more: Partial<StageSpec> = {}): StageSpec => ({ id, done, gate: false, by: "agent", prompt, ...more });

/** Problem, idea and discovery fork from intake: any of them, in any order, or none. The run asks each one's `when`. */
const FORK = ["intake", "problem", "idea", "discovery"];
const fork = (id: string, when: string) => ({ after: FORK.filter((other) => other !== id), optional: true, when });

/** Canon's flow when a repo sets none of its own. `canon init` writes none, so a repo follows it as it changes. */
export const DEFAULT_PIPELINE: StageSpec[] = [
  agent("intake", [], "Read the signals behind this work: the record, its source: and sources:, and what they link to. A signal is a user, an email, an error, a bug report or a metric. Check each one is true against what you can reach, and say which you could not check. Link the record to any open problem, idea or discovery it repeats, instead of writing a new one."),
  agent("problem", [".context/problems"], "Write what is wrong as a problem in .context/problems: who it hurts, how much, and what should be true instead. Link the ideas and discoveries it came from.", fork("problem", "something is wrong that no open problem already says")),
  agent("idea", [".context/ideas"], "Write the proposed change as an idea in .context/ideas, naming the problems it would solve and the discoveries behind it.", fork("idea", "a change is proposed that no open idea already says")),
  agent("discovery", [".context/wiki/synthesis"], "Write what was learned as a discovery in .context/wiki/synthesis/<topic>.md, with last-verified in its frontmatter and the evidence it rests on. Counts and rates only, never rows that name a person.", fork("discovery", "something new was learned: data, user behavior or a market fact")),
  agent("prioritize", [], "Set priority: on the record from the facts behind it: how many it hurts, how often, and what it costs. Name the fact each part rests on, and say which you could not find.", { after: FORK }),
  agent("collect", [".context/raw"], "Collect the data this work needs from the tools you can reach. Save each fact with canon new fact as a dated page in .context/raw/: its value, source and how it was collected. Counts and rates only, never rows that name a person. Say what you could not reach; where there is no data, write that.", { tools: FILES_AND_SHELL }),
  agent("research", [".context/wiki/synthesis"], "Using the collected facts, find what is already known: search the wiki, past outcomes and other evidence for how this was solved before. Put each finding in .context/wiki/synthesis/<topic>.md, with last-verified in its frontmatter and the facts it rests on."),
  agent("design", [".context/designs"], "Draw only the screens that change, as HTML in .context/designs, one per idea still in the running.", { optional: true, when: "a screen changes", gate: true }),
  agent("plan", [".context/plans"], "Write each way to solve the problem that is not yet an idea in .context/ideas, naming the problem under problems: and its evidence. Weigh the ideas against the facts, findings and designs with the weigh skill. Write the best one as a plan in .context/plans with its Approach and Steps, and say why the others lost.", { gate: true }),
  agent("feature", [".context/features", ".context/bugs"], "Split the approved plan into small pieces in .context/features or .context/bugs, each naming the plan."),
  agent("code", ["apps", "src", "app", "packages"], "Write the code and its tests for each piece, using everything above. Open a pull request naming the piece.", { tools: FILES_AND_SHELL, changes: true }),
  agent("review", [".github"], "Check the pull request for correctness, consistency and security. Run canon check and the tests. Fix what you find and report the rest.", { gate: true, tools: FILES_AND_SHELL }),
  { id: "release", done: [".context/ops/release.yml"], gate: false, by: "person" },
  agent("outcome", [], "Read the numbers that show whether this worked. Save a dated snapshot of counts and rates in .context/raw/. Set outcome: retained, discarded or retried, and write what happened under ## Result. A discarded or retried outcome opens a new problem that starts at intake."),
];
