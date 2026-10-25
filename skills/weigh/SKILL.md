---
name: weigh
description: Decision gate run BEFORE acting on a non-trivial request in a product repo — a new feature, screen or product, a new dependency or library, a migration or rewrite, a schema, money, pricing or store change, a release or deploy, deleting something, or a change that spans more than one product. Weighs the request against the zeno constitution, the product's wiki and ADRs, existing features and tasks, cost vs value, and writing less code, then returns do it / do it differently / push back with citations. Also use when the user types /weigh or asks "should we…", "is it worth…", "does this make sense".
---

# Weigh before acting

You are deciding whether and how to do a request — not doing it yet.
Request: `$ARGUMENTS` (empty = the user's latest request in this conversation).

## Skip the gate when it is trivial

Answer and act directly, with no verdict block, when **all** are true: one file,
no new dependency, no schema / money / store / release / delete, and the change is
fully specified (a typo, a spacing fix, a copy edit the user dictated). A
product's `.claude/zeno.yaml` may tighten this under `weigh.trivial`.

## Steps

1. **Restate the goal** in one line — what outcome the user wants, not the
   mechanism they named. A named mechanism ("use library X", "move to Firebase")
   is a proposal to weigh, not a given. Then **list the claims** the request
   makes or rests on: "users want it", "it will help retention", "it is
   missing", "it is slow". The request is not a fact (C-14); each claim is
   checked in step 4.

2. **Rules.** Run `zeno standards --constitution` for the principle titles
   (zeno's and any the team added), and read the constitution files that
   `zeno standards` lists — or `../../standards/constitution.md` (relative to
   this skill) if the CLI is not installed. Note every principle the request
   touches, by ID. Read a standard from `zeno standards` only if the request is
   in its area.

3. **Domain.** Search before you judge. Run `mcp__plugin_zeno_qmd__query` with
   the goal in plain words, then the key nouns, scoped with `collections` to
   this product's `<repo>-wiki` and `<repo>-features` (the names `zeno init`
   gives them; add `pack-<name>` when the question is about a vendor's API). Other products' hits are noise here; step 5 is where
   siblings are searched. Read the top hits with `mcp__plugin_zeno_qmd__get`. Look for: an ADR that already
   decided this, a canonical value it would change, a concept it would break.
   If qmd is unavailable, read `.context/wiki/index.md` and `decisions/`.
   **Architecture:** if `.claude/zeno.yaml` lists the `architecture` module, read
   the repo's `.dependency-cruiser.cjs` and its wiki architecture concept page.
   A request whose code would need an import a rule forbids is DO IT
   DIFFERENTLY (name the allowed path) or PUSH BACK; one that changes a rule
   is **too-large** unless a decision page already approves it. Cite the rule
   by its `name`.

4. **Claims.** Mark each claim from step 1 **backed**, **partly backed** or
   **not backed**, with the fact and its source. Look in what step 3 read, the
   code and `.context/raw/`. When that is not enough, look for a data source:
   query qmd for `SOURCE` pages in this product's wiki. Each says what it holds,
   how to read it (`mcp:`, `skill:`, `cli:` or `manual:`) and which claims it
   answers. For `manual:`, ask the user for the numbers and say where to find
   them; do not guess. If one fits, run its query and follow the query rules in `wiki-schema.md`
   ("Data sources"): read only, one or two small queries, counts not people.
   Save a result that decides the verdict to `.context/raw/`. If the tool is not
   available, say so and leave the claim not backed. If no source fits, name
   the kind of source that would answer it ("an analytics tool with weekly
   active users"). Never mark a claim backed because the user said it again.

5. **Duplicates and conflicts.** Check `.context/features/` and `.context/tasks.md`
   of this product, and the features collections of sibling products in qmd:
   is this already planned, built, shelved, or in progress elsewhere? Would it
   conflict with something in `## Now`?

6. **Cost vs value.**
   - Size: **small** (1 file, < 50 lines) · **medium** (2–5 files, < 200 lines) ·
     **large** (5+ files) · **too-large** (architecture change — split it).
   - Ongoing cost: new dependency, new service bill, more to maintain, more to
     test, store review risk.
   - Value: name the user or the metric it moves (`metrics/definitions.yml` if
     the product has one). If neither can be named, say "value unproven". A
     value claim is checked like any other claim, in step 4.
   - Evidence: say which evidence from `dev-methods.md` the work must leave — a
     feature page, a failing test first, or a metric and snapshot.

7. **Write less.** Climb the ladder and stop at the first rung that works:
   delete it → reuse something in this repo → reuse from a sibling product or
   shared script → platform or standard library → an existing well-used package
   → fewer lines → new code. If the `ponytail` plugin is installed, follow its
   ladder for this step.

8. **Too-large, or the user asked for a second opinion?** Then, and only then,
   ask the `challenger` agent for an independent read. It costs tens of
   thousands of tokens, so hand it what you already have: the request, the repo
   path, your draft verdict, and every file and wiki page you read with one line
   on what each says. It checks your reasoning and looks only where you did
   not. Where you and it disagree, show both. A large request is weighed by you
   alone.

## Verdict

Reply with exactly this block, then stop or proceed as the verdict says:

```
Verdict: DO IT | DO IT DIFFERENTLY | PUSH BACK
Goal: <one line>
Size: small | medium | large | too-large
Why:
- <C-xx> <one line> — <file or wiki page cited>
- ...
Instead: <only for DO IT DIFFERENTLY — the cheaper or safer way>
Claims:
- "<claim>" — backed | partly backed | not backed — <fact and source, or what was searched>
Assumed: <every claim not backed, or "none">
Open questions: <only if a real ambiguity blocks a good answer>
```

- Every bullet under **Why** cites a principle ID and a source (a wiki page, ADR,
  standard, feature, file or saved query result). A reason with no source is an
  opinion: drop it, or list it under **Assumed**.
- **DO IT** only when **Assumed** is "none". Proceed with the work in the same
  turn.
- **DO IT DIFFERENTLY** → proceed with the *Instead* version only if the user
  already accepted it and **Assumed** is "none"; otherwise stop and ask.
- **PUSH BACK** → stop. Do not start the work, not even a part of it.
- **Something is assumed** → stop, and give the user three choices: bring the
  facts (and say where they would go), agree to terms, or drop it. Any terms
  you show, here or later, are a numbered list, so the user can agree line by
  line.

Write the whole reply in plain words (C-15): short sentences, common words, no
jargon the wiki does not define.

## Terms (when the user wants to go on anyway)

When the user wants to go on despite a PUSH BACK or an assumption, write the
terms as a numbered list: what is in scope, what is out, which rule changes and
which stays, and how the assumption will be checked later (a metric and a
date). A fact the user gives in chat is saved to `.context/raw/` first, then
listed as a fact, not as proof of more than it shows.

Proceed only after the user agrees in writing ("agree", or "agree to 1–4").
"Go ahead" to a verdict is not agreement to terms that were never shown. Work
covers only the terms agreed to.

## Logging (push back and overrides)

When the user overrides a PUSH BACK, rejects a DO IT DIFFERENTLY or agrees to
terms, append one line to the product's log so zeno can learn from it later.
Pass each agreed term with its own `--term`:

```bash
node ../../scripts/log-verdict.mjs --verdict push-back --principles C-04,C-14 \
  --request "<one line>" --reason "<the user's reason, verbatim>" \
  --term "<term 1>" --term "<term 2>"
```

(path relative to this skill). It writes to `.context/raw/zeno/verdicts.jsonl`
in the current repo. Never edit or delete existing lines.
