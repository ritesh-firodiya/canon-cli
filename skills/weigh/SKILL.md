---
name: weigh
description: Decision gate run BEFORE acting on a non-trivial request in a product repo — a new feature, screen or product, a new dependency or library, a migration or rewrite, a schema, money, pricing or store change, a release or deploy, deleting something, or any change touching more than one file or more than one product. Weighs the request against the zeno constitution, the product's wiki and ADRs, existing features and tasks, cost vs value, and writing less code, then returns do it / do it differently / push back with citations. Also use when the user types /weigh or asks "should we…", "is it worth…", "does this make sense".
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
   is a proposal to weigh, not a given.

2. **Rules.** Run `zeno standards --constitution` for the principle titles
   (zeno's and any the team added), and read the constitution files that
   `zeno standards` lists — or `../../standards/constitution.md` (relative to
   this skill) if the CLI is not installed. Note every principle the request
   touches, by ID. Read a standard from `zeno standards` only if the request is
   in its area.

3. **Domain.** Search before you judge. Run `mcp__plugin_zeno_qmd__query` with
   the goal in plain words, then the key nouns (product name + topic). Read the
   top hits with `mcp__plugin_zeno_qmd__get`. Look for: an ADR that already
   decided this, a canonical value it would change, a concept it would break.
   If qmd is unavailable, read `.context/wiki/index.md` and `decisions/`.
   **Architecture:** if `.claude/zeno.yaml` lists the `architecture` module, read
   the repo's `.dependency-cruiser.cjs` and its wiki architecture concept page.
   A request whose code would need an import a rule forbids is DO IT
   DIFFERENTLY (name the allowed path) or PUSH BACK; one that changes a rule
   is **too-large** unless a decision page already approves it. Cite the rule
   by its `name`.

4. **Duplicates and conflicts.** Check `.context/features/` and `.context/tasks.md`
   of this product, and the features collections of sibling products in qmd:
   is this already planned, built, shelved, or in progress elsewhere? Would it
   conflict with something in `## Now`?

5. **Cost vs value.**
   - Size: **small** (1 file, < 50 lines) · **medium** (2–5 files, < 200 lines) ·
     **large** (5+ files) · **too-large** (architecture change — split it).
   - Ongoing cost: new dependency, new service bill, more to maintain, more to
     test, store review risk.
   - Value: name the user or the metric it moves (`metrics/definitions.yml` if
     the product has one). If neither can be named, say "value unproven".

6. **Write less.** Climb the ladder and stop at the first rung that works:
   delete it → reuse something in this repo → reuse from a sibling product or
   shared script → platform or standard library → an existing well-used package
   → fewer lines → new code. If the `ponytail` plugin is installed, follow its
   ladder for this step.

7. **Large or too-large?** Delegate steps 2–6 to the `challenger` agent for an
   independent read — pass it the request, the repo path and the constitution
   and standards paths from step 2 — then reconcile: where you and it disagree,
   show both.

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
Open questions: <only if a real ambiguity blocks a good answer>
```

- Every bullet under **Why** cites a principle ID and a source (a wiki page, ADR,
  standard, feature or file). A reason with no source is an opinion — drop it or
  mark it "unverified".
- **DO IT** → proceed with the work in the same turn.
- **DO IT DIFFERENTLY** → proceed with the *Instead* version only if the user
  already accepted it; otherwise stop and ask which way.
- **PUSH BACK** → stop. Do not start the work, not even a part of it. Ask for
  the reason. When the user gives one, log it (below), then proceed as they say.

## Logging (push back and overrides)

When the user overrides a PUSH BACK or rejects a DO IT DIFFERENTLY, append one
line to the product's log so zeno can learn from it later:

```bash
node ../../scripts/log-verdict.mjs --verdict push-back --principles C-05,C-06 \
  --request "<one line>" --reason "<the user's reason, verbatim>"
```

(path relative to this skill). It writes to `.context/raw/zeno/verdicts.jsonl`
in the current repo. Never edit or delete existing lines.
