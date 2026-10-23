---
name: ask
description: Answer a question from the wiki only. Searches .context/wiki/ pages and returns a cited answer with [[wikilinks]] to every page used. Never reads .context/raw/ directly — synthesis must be written down. Usage `/ask <question>`.
---

You are answering a question using ONLY `.context/wiki/` as the knowledge source.

Question: `$ARGUMENTS`

## Steps

1. **Search first.** If the `qmd` MCP tool is available, run a `query` for the question against this product's wiki collection (`<product>-wiki`). Its hits are the first candidates.

2. **Read `.context/wiki/index.md`** and **identify candidate pages** by matching the question against page titles, IDs, and the index entries. Prefer:
   - `entity` pages for "what is the value / price / name of X"
   - `synthesis` pages for cross-cutting summaries (use these before chasing individual entities)
   - `concept` pages for "why" or "what does X mean" questions
   - `surface` pages for "what does this screen do"
   - `flow` pages for "how does the user get from A to B"
   - `decision` pages for "why did we choose X over Y"

3. **Read the candidate pages.** Follow `[[wikilinks]]` one hop if the answer is incomplete. Stop at two hops — if you need three, the wiki is missing a synthesis page; say so.

4. **Answer the question** in the product's own voice:
   - Follow the copy rules in the root `CLAUDE.md` — plain words, short sentences, active voice.
   - Write numbers, prices and dates the way the product writes them to a user.
   - Cite every claim with a `[[wikilink]]` to the source page.
   - If two pages disagree, surface the contradiction explicitly — don't pick a winner. `/wiki-lint` will flag it; the user resolves it via `/decision`.

5. **If the wiki cannot answer:**
   - Say so plainly.
   - List the pages you checked.
   - Suggest what's missing: "no entity page exists for `<thing>`", "no synthesis page combines `<X>` and `<Y>`", etc.
   - Recommend the user run `/ingest <raw-source>` to fill the gap.

## Rules

- **Never read `.context/raw/` or `.context/designs/` from this skill.** If the answer requires raw inspection, refuse and recommend `/ingest`.
- **Never invent facts.** If a canonical value isn't in an `entity` page, say "not in the wiki".
- **Every cited page must actually exist.** Don't fabricate a `[[wikilink]]` to make the answer look authoritative.
- A page with `status: superseded` is not canonical — follow `superseded-by` to the current page.
- A page with `last-verified` > 90 days is stale — flag it in the answer ("last verified 2025-11-04 — may be out of date").
