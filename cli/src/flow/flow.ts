import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config/load.ts";
import { gh, git, repoFacts, type Facts, type GitHub } from "./facts.ts";
import { belongs, type Session } from "./sessions.ts";

// How far each Claude conversation about a product got, measured against the product's own stages, and how long
// each step took. Counts and times only; no prompt text leaves this machine. The transcripts live in
// ~/.claude/projects and CI cannot see them, so this runs here and the product repo carries the result.
//
// A conversation is about a product when it worked in the product's folder; one that named no product folder may
// still be, through its commits: the repo commits made within MATCH_SECONDS of a `git commit` it ran (rtk prints
// "ok", not the hash, so time is the link). Time alone never ties a conversation that worked in other products to
// this one: estate-wide chores commit to every repo at once.
//
// What each stage needs:
//   idea          the conversation exists
//   research      it searched or fetched the web, or a commit touched .context/raw/ or .context/wiki/synthesis/
//   plan          a commit touched .context/features/, tasks.md or wiki/decisions/
//   design        a commit touched .context/designs/
//   code          a commit touched anything outside .context/ and .claude/
//   review        a commit is in a merged pull request
//   release       a version tag holds a commit (an untagged version: the commit that set it)
//   store-review  the version release.yml lists as in review holds a commit
//   deployed      a GitHub deployment, or the web commit release.yml lists, holds a commit
//   live          a version release.yml lists as live holds a commit
// A conversation counts at every stage up to the furthest it reached.

const MATCH_SECONDS = 120;
export const KNOWN = ["idea", "research", "plan", "design", "code", "review", "release", "store-review", "deployed", "live"];
const TOUCH: Record<string, string[]> = {
  research: [".context/raw/", ".context/wiki/synthesis/"],
  plan: [".context/features/", ".context/tasks.md", ".context/wiki/decisions/"],
  design: [".context/designs/"],
};

export interface FlowResult {
  $comment: string;
  updated: string;
  since: string | null;
  stages: { id: string; count: number }[];
  medianHours: Record<string, number | null>;
}

type Reached = Map<string, Date | null>;

/** {stage: when it was first reached} for one conversation. */
function reached(session: Session, commits: [string, Date][], repo: string, facts: Facts): Reached {
  const at: Reached = new Map([["idea", session.start]]);
  const first = (stage: string, when: Date | null | undefined) => at.has(stage) || at.set(stage, when ?? null);
  if (session.web) at.set("research", session.web);
  for (const [sha, when] of [...commits].sort((a, b) => a[1].getTime() - b[1].getTime())) {
    const files = git(repo, "show", "--name-only", "--format=", sha).split(/\s+/).filter(Boolean);
    for (const [stage, prefixes] of Object.entries(TOUCH)) if (files.some((f) => prefixes.some((p) => f.startsWith(p)))) first(stage, when);
    if (files.some((f) => !f.startsWith(".context/") && !f.startsWith(".claude/"))) first("code", when);
    if (facts.merged.has(sha)) first("review", facts.merged.get(sha));
    if (facts.released.has(sha)) first("release", facts.released.get(sha));
    if (facts.inReview.has(sha)) first("store-review", facts.reviewAt ?? facts.released.get(sha));
    if (facts.deployed.has(sha)) first("deployed", facts.deployed.get(sha));
    if (facts.live.has(sha)) first("live", facts.released.get(sha));
  }
  return at;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** The product's own stages, as canon resolves them; each needs an evidence rule above. */
function stagesOf(repo: string): string[] {
  const ids = loadConfig(repo).config.pipeline.map((s) => s.id);
  const unknown = ids.filter((id) => !KNOWN.includes(id));
  if (unknown.length) throw new Error(`${repo}: no evidence rule for stage(s) ${unknown.join(", ")} — known: ${KNOWN.join(", ")}`);
  return ids;
}

export function flow(workspace: string, product: string, sessions: Session[], formerly: string[] = [], github: GitHub = gh): FlowResult {
  const repo = join(workspace, product);
  const stages = stagesOf(repo);
  const commits = git(repo, "log", "--all", "--format=%H %cI")
    .split("\n")
    .filter(Boolean)
    .map((line): [string, Date] => {
      const [sha, date] = line.split(" ");
      return [sha, new Date(date)];
    });
  const facts = repoFacts(repo, github);
  const names = new Set([product, ...formerly]);
  const known = new Set([...readdirSync(workspace).filter((d) => existsSync(join(workspace, d, ".git"))), ...names]);
  const pairs = stages.slice(1).map((b, i) => [stages[i], b] as const);
  const waits = new Map(pairs.map(([a, b]) => [`${a}→${b}`, [] as number[]]));
  const furthest: number[] = [];
  let first: Date | null = null;

  for (const s of sessions) {
    if (!belongs(s.where, names, known)) continue;
    const mine = commits.filter(([, when]) => s.calls.some((t) => Math.abs(when.getTime() - t.getTime()) / 1000 <= MATCH_SECONDS));
    // Never worked in this product's folder, under any of its names, nor committed to it.
    if (![...s.where].some((w) => names.has(w)) && !mine.length) continue;
    if (!first || s.start < first) first = s.start;
    const at = reached(s, mine, repo, facts);
    furthest.push(Math.max(...stages.flatMap((st, i) => (at.has(st) ? [i] : []))));
    for (const [a, b] of pairs) {
      const from = at.get(a);
      const to = at.get(b);
      if (from && to && to >= from) waits.get(`${a}→${b}`)?.push((to.getTime() - from.getTime()) / 3_600_000);
    }
  }

  return {
    $comment: "GENERATED by `canon flow` from local Claude transcripts, git, GitHub and release.yml. Counts only. Do not hand-edit.",
    updated: isoDay(new Date()),
    since: first ? isoDay(first) : null,
    stages: stages.map((id, i) => ({ id, count: furthest.filter((f) => f >= i).length })),
    medianHours: Object.fromEntries([...waits].map(([k, v]) => {
      const m = median(v);
      return [k, m === null ? null : Math.round(m * 10) / 10];
    })),
  };
}
