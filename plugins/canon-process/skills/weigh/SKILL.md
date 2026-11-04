---
name: weigh
description: Decision gate run BEFORE acting on a non-trivial request in a product repo — a new feature, screen or product, a new dependency or library, a migration or rewrite, a schema, money, pricing or store change, a release or deploy, deleting something, a change to how work flows (branching, review, release process), or a change that spans more than one product. Weighs the request against the canon constitution, the product's wiki and ADRs, existing features and tasks, cost vs value, and writing less code, then returns do it / do it differently / push back with citations. Also use when the user types /weigh or asks "should we…", "is it worth…", "does this make sense".
---

# Weigh before acting

You are deciding whether and how to do a request — not doing it yet.
Request: `$ARGUMENTS` (empty = the user's latest request in this conversation).

## Skip the gate when it is trivial

Answer and act directly, with no verdict block, when **all** are true: one file,
no new dependency, no schema / money / store / release / delete, and the change is
fully specified (a typo, a spacing fix, a copy edit the user dictated). A
product's `.context/context.yaml` may tighten this under `weigh.trivial`.

## Weigh with fresh eyes

Hand the request to the `weigher` agent, which never saw this conversation: a reviewer without the chat is not swayed by how the request was put, and its reading stays out of this session. Give it, in one message:

- the request, verbatim;
- the repo path;
- the facts this conversation already holds that bear on it, each with where it came from (a file, a command's output, or "the user said").

It returns the verdict block below. Show it as it came; do not soften it.

**Too-large, or the user asked for a second opinion?** Then, and only then, ask
the `challenger` agent for an independent read too. It costs tens of thousands of
tokens, so hand it the request, the repo path, the weigher's verdict and the files
it read. Where the two disagree, show both. A large request is weighed by the
weigher alone.

## Verdict

The weigher replies with exactly this block; you then stop or proceed as the verdict says:

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

## Recording (every verdict)

A verdict goes on the record it judged. Record it once, when you know what
happened next. A trivial request that skipped the gate is not recorded.
`--outcome` is one of:

- `proceeded` — work went ahead as the verdict said (DO IT, or an accepted
  *Instead*).
- `stopped` — you stopped and asked, and the user has not answered yet. If the
  user later overrides, record a second one.
- `overridden` — the user went on against a PUSH BACK, rejected a DO IT
  DIFFERENTLY, or agreed to terms. `--reason` is required: the user's reason,
  verbatim. Pass each agreed term with its own `--term`.
- `dropped` — the user chose to drop the request.

```bash
canon verdict --record PLAN-0001 --verdict push-back --outcome overridden \
  --principles C-04,C-14 --request "<one line>" \
  --reason "<the user's reason, verbatim>" --term "<term 1>" --term "<term 2>"
```

With no `--record`, a stopped, dropped or overridden request becomes a new Idea,
so a rejected request is not proposed again unseen; one that simply proceeded is
only logged, since the work records it. Never edit an earlier
line of a `## Verdict` section. `canon learn` reads them across products: how
often the gate stops work, and which rules keep being overridden.
