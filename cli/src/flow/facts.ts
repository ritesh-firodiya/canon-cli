import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse } from "yaml";

// A release is a version tag; `stash-bak-0` and friends are not.
export const RELEASE_TAG = /^(?:[a-z]+-)?v(\d+\.\d+(?:\.\d+)?)/;

/** What git, GitHub and release.yml say happened to each commit, and when. */
export interface Facts {
  released: Map<string, Date>;
  merged: Map<string, Date>;
  inReview: Set<string>;
  reviewAt: Date | null;
  live: Set<string>;
  deployed: Map<string, Date | null>;
}

export function run(command: string, args: string[], cwd?: string): string {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `${command} exited ${result.status}`);
  return result.stdout;
}

export const git = (repo: string, ...args: string[]) => run("git", ["-C", repo, ...args]);

/** A release.yml date: '2026-10-27' or a full timestamp. */
export const day = (value: unknown): Date => (String(value).includes("T") ? new Date(String(value)) : new Date(`${value}T00:00:00+00:00`));

/** '1.4.3', '2.0.1 (15)', {version: '1.4.3'} → '1.4.3'. */
export function versionOf(value: unknown): string | null {
  const v = value && typeof value === "object" ? ((value as Record<string, unknown>).version ?? (value as Record<string, unknown>).string) : value;
  if (!v) return null;
  return /^\s*v?(\d+\.\d+(?:\.\d+)?)/.exec(String(v))?.[1] ?? null;
}

function reachable(repo: string, ref: string): string[] {
  try {
    return git(repo, "rev-list", ref).split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

const setDefault = <V>(map: Map<string, V>, key: string, value: V) => map.has(key) || map.set(key, value);

type Surface = Record<string, unknown>;

function releaseSurfaces(repo: string): Record<string, unknown> {
  const path = join(repo, ".context", "ops", "release.yml");
  if (!existsSync(path)) return {};
  return (parse(readFileSync(path, "utf8"))?.surfaces as Record<string, unknown>) ?? {};
}

/** Reads one GitHub list, every page, flattened. */
export type GitHub = (path: string) => unknown[];
export const gh: GitHub = (path) => (JSON.parse(run("gh", ["api", "--paginate", "--slurp", path])) as unknown[][]).flat();

export function repoFacts(repo: string, github: GitHub = gh): Facts {
  const ghList = <T>(path: string) => github(path) as T[];
  const tags = git(repo, "tag", "--format=%(refname:short) %(creatordate:iso-strict)")
    .split("\n")
    .flatMap((line) => {
      const [name, date = ""] = [line.slice(0, line.indexOf(" ")), line.slice(line.indexOf(" ") + 1)];
      const version = RELEASE_TAG.exec(name)?.[1];
      return version && line.includes(" ") ? [{ date: new Date(date), name, version }] : [];
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime() || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const released = new Map<string, Date>();
  const byVersion = new Map<string, Set<string>>();
  // Oldest first: a commit's release is the first tag that holds it.
  for (const tag of tags) {
    const held = reachable(repo, tag.name);
    byVersion.set(tag.version, new Set([...(byVersion.get(tag.version) ?? []), ...held]));
    for (const sha of held) setDefault(released, sha, tag.date);
  }
  const slug = git(repo, "remote", "get-url", "origin").trim().replace(/^.*github\.com[:/]|\.git$/g, "");

  // What a version holds: its tag, or, never tagged, everything up to the commit that first set it.
  const versionHeld = (v: string): Set<string> => {
    const tagged = byVersion.get(v);
    if (tagged) return tagged;
    const [sha, when] = git(repo, "log", "--all", "--reverse", "--format=%H %cI", "-S", `"version": "${v}"`).split("\n")[0].split(/\s+/);
    if (!sha) return new Set();
    const held = reachable(repo, sha);
    for (const c of held) setDefault(released, c, new Date(when));
    return new Set(held);
  };

  const inReview = new Set<string>();
  const live = new Set<string>();
  const deployed = new Map<string, Date | null>();
  let reviewAt: Date | null = null;
  for (const [key, value] of Object.entries(releaseSurfaces(repo))) {
    if (!value || typeof value !== "object" || Array.isArray(value) || (value as Surface).verified === false) continue;
    const s = value as Surface;
    const review = versionOf(s.in_review);
    if (review) {
      versionHeld(review).forEach((sha) => inReview.add(sha));
      const submitted = s.in_review && typeof s.in_review === "object" ? (s.in_review as Surface).submitted : null;
      if (submitted) reviewAt = day(submitted);
    }
    const liveVersion = versionOf(s.live);
    if (liveVersion) versionHeld(liveVersion).forEach((sha) => live.add(sha));
    const dep = s.deployed as Surface | undefined;
    if (key === "web" && dep && typeof dep === "object" && dep.commit) {
      const when = dep.since ? day(dep.since) : null;
      for (const sha of reachable(repo, String(dep.commit))) setDefault(deployed, sha, when);
    }
  }

  const name = basename(repo);
  // Every deployment GitHub recorded (Vercel and Cloudflare post them), oldest first.
  try {
    const list = ghList<{ sha: string; created_at: string }>(`repos/${slug}/deployments?per_page=100`).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    for (const d of list) for (const sha of reachable(repo, d.sha)) setDefault(deployed, sha, new Date(d.created_at));
  } catch (error) {
    console.error(`  ${name}: deployments not read (${(error as Error).message}); Deployed counts only release.yml`);
  }

  const merged = new Map<string, Date>();
  try {
    type Pull = { number: number; merged_at: string | null; merge_commit_sha: string };
    for (const pr of ghList<Pull>(`repos/${slug}/pulls?state=closed&per_page=100`).filter((p) => p.merged_at)) {
      const when = new Date(pr.merged_at as string);
      merged.set(pr.merge_commit_sha, when);
      // A squash merge makes a new commit; the conversation's own commits are the PR's.
      for (const c of ghList<{ sha: string }>(`repos/${slug}/pulls/${pr.number}/commits?per_page=100`)) setDefault(merged, c.sha, when);
    }
  } catch (error) {
    // Review then shows 0, never a guess, and says why.
    console.error(`  ${name}: pull requests not read (${(error as Error).message}); Review counts nothing`);
  }
  return { released, merged, inReview, reviewAt, live, deployed };
}
