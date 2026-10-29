#!/usr/bin/env python3
"""How far each Claude conversation about a product got, measured against the
product's own stages (`canon pipeline`), and how long each step took. Counts
and times only; no prompt text leaves this machine.

    canon flow askcal            print the numbers
    canon flow askcal --write    also write <product>/.context/metrics/flow.json

`canon flow` runs this with CANON_WORKSPACE (the folder holding the products) and
CANON_FLOW_FORMERLY (each product's older folder names, from `formerly:` in its canon.yaml).

The transcripts live in ~/.claude/projects and CI cannot see them, so this
runs here and the product repo carries the result.

A conversation is a transcript with at least one typed request. It is about a
product when it worked in that product's folder; one that named no product
folder at all may still be, through its commits. Its commits are the repo
commits made within MATCH_SECONDS of a `git commit` it ran (rtk prints "ok",
not the hash, so time is the link). Time alone never ties a conversation that
worked in other products to this one: estate-wide chores commit to every repo
at once, and would credit each product with the others' conversations.
What each stage needs:

  idea          the conversation exists
  research      it searched or fetched the web, or a commit touched
                .context/raw/ or .context/wiki/synthesis/
  plan          a commit touched .context/features/, tasks.md or wiki/decisions/
  design        a commit touched .context/designs/
  code          a commit touched anything outside .context/ and .claude/
  review        a commit is in a merged pull request
  release       a version tag holds a commit (an untagged version: the commit that set it)
  store-review  the version release.yml lists as in review holds a commit
  deployed      a GitHub deployment, or the web commit release.yml lists, holds a commit
  live          a version release.yml lists as live holds a commit

A conversation counts at every stage up to the furthest it reached.
"""
import glob
import json
import os
import re
import statistics
import subprocess
import sys
from datetime import datetime, timezone

MATCH_SECONDS = 120
PRODUCTS = os.environ["CANON_WORKSPACE"]
TRANSCRIPTS = os.path.expanduser("~/.claude/projects")
COMMIT_CALL = re.compile(r"\bgit\b[^|;&]*\bcommit\b")
# A release is a version tag; `stash-bak-0` and friends are not.
RELEASE_TAG = re.compile(r"^(?:[a-z]+-)?v(\d+\.\d+(?:\.\d+)?)")
WEB_TOOLS = {"WebSearch", "WebFetch"}
# A renamed product's conversations under its old folder name are still about it.
ALIASES = json.loads(os.environ.get("CANON_FLOW_FORMERLY") or "{}")
# A product folder named in full or from ~ ("~/git/products/chess").
PRODUCT_PATH = re.compile(r"(?:" + re.escape(PRODUCTS) + "|" + re.escape(PRODUCTS.replace(os.path.expanduser("~"), "~", 1)) + r")/([A-Za-z0-9._-]+)")
KNOWN = ["idea", "research", "plan", "design", "code", "review", "release", "store-review", "deployed", "live"]
TOUCH = {
    "research": (".context/raw/", ".context/wiki/synthesis/"),
    "plan": (".context/features/", ".context/tasks.md", ".context/wiki/decisions/"),
    "design": (".context/designs/",),
}


def ts(s):
    return datetime.fromisoformat(str(s).replace("Z", "+00:00"))


def day(v):
    """A release.yml date: '2026-10-27' or a full timestamp."""
    return ts(v) if "T" in str(v) else ts(f"{v}T00:00:00+00:00")


def run(*cmd, cwd=None):
    return subprocess.run(cmd, capture_output=True, text=True, check=True, cwd=cwd).stdout


def git(repo, *args):
    return run("git", "-C", repo, *args)


def read_session(path):
    """Start, typed requests, `git commit` call times, first web-research time, and the
    product folders it worked in (its working folders and the paths its tools named;
    never tool output, which can list every product)."""
    times, commits, asks, web, where = [], [], 0, None, set()
    with open(path, errors="ignore") as f:
        for line in f:
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not e.get("timestamp"):
                continue
            t = ts(e["timestamp"])
            times.append(t)
            where.update(PRODUCT_PATH.findall(e.get("cwd") or ""))
            content = e.get("message", {}).get("content")
            if e.get("type") == "user" and not e.get("isMeta") and isinstance(content, str) and not content.lstrip().startswith("<"):
                asks += 1
            if e.get("type") == "assistant" and isinstance(content, list):
                for c in content:
                    if c.get("type") != "tool_use":
                        continue
                    where.update(PRODUCT_PATH.findall(json.dumps(c.get("input", {}))))
                    if c.get("name") in WEB_TOOLS and web is None:
                        web = t
                    if COMMIT_CALL.search(c.get("input", {}).get("command", "")):
                        commits.append(t)
    if not times or asks == 0:
        return None
    return {"start": min(times), "calls": commits, "web": web, "where": where}


def belongs(where, names, known):
    """Whether a conversation can be about a product: it worked in the product's folder, or in no
    product folder (then only its commits can tie it). `where` also catches files like CLAUDE.md,
    so only names that are product repos count."""
    products = where & known
    return bool(products & names) or not products


def all_sessions():
    # Every folder: a conversation started in ~ or ~/git can still have worked in a product.
    return {p: s for p in glob.glob(f"{TRANSCRIPTS}/*/*.jsonl") if (s := read_session(p))}


def stages_of(repo):
    """The product's own stages, as canon resolves them."""
    ids = [s["id"] for s in json.loads(run("canon", "pipeline", repo, "--json"))]
    unknown = [i for i in ids if i not in KNOWN]
    if unknown:
        sys.exit(f"{repo}: no evidence rule for stage(s) {', '.join(unknown)} — known: {', '.join(KNOWN)}")
    return ids


def release_state(repo):
    """release.yml as data. Ruby's YAML is on every Mac; Python's is not."""
    path = os.path.join(repo, ".context", "ops", "release.yml")
    if not os.path.exists(path):
        return {}
    out = run("ruby", "-ryaml", "-rjson", "-rdate", "-e",
              "puts YAML.load_file(ARGV[0], permitted_classes: [Date, Time, Symbol]).to_json", path)
    return json.loads(out).get("surfaces") or {}


def version_of(value):
    """'1.4.3', '2.0.1 (15)', {version: '1.4.3'} → '1.4.3'."""
    if isinstance(value, dict):
        value = value.get("version") or value.get("string")
    m = re.match(r"\s*v?(\d+\.\d+(?:\.\d+)?)", str(value)) if value else None
    return m.group(1) if m else None


def reachable(repo, ref):
    try:
        return set(git(repo, "rev-list", ref).split())
    except subprocess.CalledProcessError:
        return set()


def repo_facts(repo):
    tags = []
    for line in git(repo, "tag", "--format=%(refname:short) %(creatordate:iso-strict)").splitlines():
        name, _, date = line.partition(" ")
        m = RELEASE_TAG.match(name)
        if m:
            tags.append((ts(date), name, m.group(1)))
    tags.sort()
    released, by_version = {}, {}
    for date, name, version in tags:  # oldest first: a commit's release is the first tag that holds it
        held = reachable(repo, name)
        by_version.setdefault(version, set()).update(held)
        for sha in held:
            released.setdefault(sha, date)

    slug = re.sub(r"^.*github\.com[:/]|\.git$", "", git(repo, "remote", "get-url", "origin").strip())

    def version_held(v):
        """What a version holds: its tag, or — when it was never tagged — everything up to the
        commit that first set that version (`chore(release): 1.4.3 (build 17)`)."""
        if v in by_version:
            return by_version[v]
        bump = git(repo, "log", "--all", "--reverse", "--format=%H %cI", "-S", f'"version": "{v}"').split("\n")[0].split()
        if not bump:
            return set()
        held = reachable(repo, bump[0])
        for sha in held:
            released.setdefault(sha, ts(bump[1]))
        return held

    surfaces = release_state(repo)
    in_review, live, deployed = set(), set(), {}
    review_at = None
    for key, s in surfaces.items():
        if not isinstance(s, dict) or s.get("verified") is False:
            continue
        v = version_of(s.get("in_review"))
        if v:
            in_review |= version_held(v)
            sub = s["in_review"].get("submitted") if isinstance(s.get("in_review"), dict) else None
            review_at = day(sub) if sub else review_at
        lv = version_of(s.get("live"))
        if lv:
            live |= version_held(lv)
        dep = s.get("deployed")
        if key == "web" and isinstance(dep, dict) and dep.get("commit"):
            when = day(dep["since"]) if dep.get("since") else None
            for sha in reachable(repo, str(dep["commit"])):
                deployed.setdefault(sha, when)

    # Every deployment GitHub recorded (Vercel and Cloudflare post them), oldest first.
    try:
        pages = json.loads(run("gh", "api", "--paginate", "--slurp", f"repos/{slug}/deployments?per_page=100"))
        for d in sorted((d for page in pages for d in page), key=lambda d: d["created_at"]):
            for sha in reachable(repo, d["sha"]):
                deployed.setdefault(sha, ts(d["created_at"]))
    except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError) as e:
        print(f"  {os.path.basename(repo)}: deployments not read ({getattr(e, 'stderr', '') or e}); Deployed counts only release.yml", file=sys.stderr)

    merged = {}
    try:
        pulls = json.loads(run("gh", "api", "--paginate", "--slurp", f"repos/{slug}/pulls?state=closed&per_page=100"))
        for pr in (p for page in pulls for p in page if p.get("merged_at")):
            when = ts(pr["merged_at"])
            merged[pr["merge_commit_sha"]] = when
            # A squash merge makes a new commit; the conversation's own commits are the PR's.
            for c in json.loads(run("gh", "api", "--paginate", "--slurp", f"repos/{slug}/pulls/{pr['number']}/commits?per_page=100")):
                for commit in c:
                    merged.setdefault(commit["sha"], when)
    except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError) as e:
        # Review then shows 0, never a guess — and says why.
        print(f"  {os.path.basename(repo)}: pull requests not read ({getattr(e, 'stderr', '') or e}); Review counts nothing", file=sys.stderr)
    return {"released": released, "merged": merged, "in_review": in_review, "review_at": review_at,
            "live": live, "deployed": deployed}


def touched(repo, sha):
    return git(repo, "show", "--name-only", "--format=", sha).split()


def reached(session, commits, repo, facts):
    """{stage: when it was first reached} for one conversation."""
    at = {"idea": session["start"]}
    if session["web"]:
        at["research"] = session["web"]
    for sha, when in sorted(commits, key=lambda c: c[1]):
        files = touched(repo, sha)
        for stage, prefixes in TOUCH.items():
            if any(f.startswith(prefixes) for f in files):
                at.setdefault(stage, when)
        if any(not f.startswith((".context/", ".claude/")) for f in files):
            at.setdefault("code", when)
        if sha in facts["merged"]:
            at.setdefault("review", facts["merged"][sha])
        if sha in facts["released"]:
            at.setdefault("release", facts["released"][sha])
        if sha in facts["in_review"]:
            at.setdefault("store-review", facts["review_at"] or facts["released"].get(sha))
        if sha in facts["deployed"]:
            at.setdefault("deployed", facts["deployed"][sha])
        if sha in facts["live"]:
            at.setdefault("live", facts["released"].get(sha))
    return at


def flow(product, sessions):
    repo = os.path.join(PRODUCTS, product)
    stages = stages_of(repo)
    log = [l.split() for l in git(repo, "log", "--all", "--format=%H %cI").splitlines() if l]
    commits = [(h, ts(d)) for h, d in log]
    facts = repo_facts(repo)
    names = {product, *ALIASES.get(product, [])}
    known = {d for d in os.listdir(PRODUCTS) if os.path.isdir(os.path.join(PRODUCTS, d, ".git"))} | names

    furthest, waits, first = [], {f"{a}→{b}": [] for a, b in zip(stages, stages[1:])}, None
    for path, s in sessions.items():
        if not belongs(s["where"], names, known):
            continue
        mine = [c for c in commits if any(abs((c[1] - t).total_seconds()) <= MATCH_SECONDS for t in s["calls"])]
        if not (s["where"] & names) and not mine:
            continue  # never worked in this product's folder, under any of its names, nor committed to it
        first = min(first, s["start"]) if first else s["start"]
        at = reached(s, mine, repo, facts)
        hit = [i for i, st in enumerate(stages) if st in at]
        furthest.append(max(hit))
        for a, b in zip(stages, stages[1:]):
            if a in at and b in at and at[a] and at[b] and at[b] >= at[a]:
                waits[f"{a}→{b}"].append((at[b] - at[a]).total_seconds() / 3600)

    return {
        "$comment": "GENERATED by `canon flow` from local Claude transcripts, git, GitHub and release.yml. Counts only. Do not hand-edit.",
        "updated": datetime.now(timezone.utc).date().isoformat(),
        "since": first.date().isoformat() if first else None,
        "stages": [{"id": st, "count": sum(1 for f in furthest if f >= i)} for i, st in enumerate(stages)],
        "medianHours": {k: round(statistics.median(v), 1) if v else None for k, v in waits.items()},
    }


def self_check():
    assert RELEASE_TAG.match("v1.4.1") and RELEASE_TAG.match("mobile-v0.1.1")
    assert not RELEASE_TAG.match("stash-bak-0")
    assert COMMIT_CALL.search('git -C askcal commit -m "x"') and COMMIT_CALL.search("git commit -q -F -")
    assert not COMMIT_CALL.search("git status; echo commit")
    assert day("2026-10-27").hour == 0 and day("2026-09-30T17:43:43+00:00").hour == 17
    assert belongs({"chess", "CLAUDE.md"}, {"chess"}, {"chess", "babul"}) and belongs({"CLAUDE.md"}, {"chess"}, {"chess", "babul"})
    assert not belongs({"babul", "bin"}, {"chess"}, {"chess", "babul"})
    assert PRODUCT_PATH.findall(f"cd {PRODUCTS}/chess && git -C ~/git/products/babul status".replace("~/git/products", PRODUCTS.replace(os.path.expanduser("~"), "~", 1))) == ["chess", "babul"]
    assert version_of("2.0.1 (15)") == "2.0.1" and version_of({"version": "1.4.3"}) == "1.4.3" and version_of(None) is None


def main():
    self_check()
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit("usage: canon flow <product>... [--write]")
    sessions = all_sessions()
    for product in args:
        if not os.path.isdir(os.path.join(PRODUCTS, product, ".git")):
            sys.exit(f"{product}: not a repo under {PRODUCTS}")
        result = flow(product, sessions)
        print(product, " → ".join(f"{s['id']} {s['count']}" for s in result["stages"]), "| since", result["since"])
        if "--write" in sys.argv:
            out = os.path.join(PRODUCTS, product, ".context", "metrics", "flow.json")
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, "w") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
                f.write("\n")


if __name__ == "__main__":
    main()
