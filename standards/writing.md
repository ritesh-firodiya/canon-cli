# Writing

How every page in `.context/` reads. Where pages live is in `context.md`. Together
they are **Plain Context**: a newcomer, person or agent, reads a page once and knows
what is true, why, and who said so.

A team can replace this file with its own `writing.md` in a configured standards
folder.

## The test

Keep a line only if an agent would get something wrong without it. Never write what
the code, a design or `git log` already says. Write what is true **now**; history is
git's job.

## Every page

- **One topic.** One file per topic, named for it, edited in place. No dated names,
  no `v2`, no chains of pages that replace each other.
- **First line says what it is for.** Right under the title: what the page decides
  or explains, in one sentence.
- **Plain words.** Short sentences, common words. A word the product uses in its own
  way is in `glossary.md`. Bullets and tables over paragraphs.
- **Facts carry a source and a date.** "Churn was 3× annual (2026-06 test, `raw/…`)".
  With no source, say there is none.
- **Choices say who and when.** "(owner, 2026-11-05)" or "proposed by Claude,
  accepted by the owner, 2026-11-05". A guess is never written as a choice.
- **Only sections with something in them.** No `TBD`, no `none yet`.
- **Short.** A page is at most 60 lines, a decision 30. Research in `synthesis/` is
  exempt.
- **Links are relative Markdown links:** `[runtime](../decisions/runtime.md)`, so
  every viewer can follow them. A record can be named by its ID (`PLAN-0001`).
- **Frontmatter:** `last-verified: YYYY-MM-DD` is the only required field. Keep `id`
  where code refers to the page (`SOURCE.*`, entity keys). Keys are kebab-case.

## Page shapes

**Purpose** (`wiki/concepts/purpose.md`):

```markdown
# Purpose
What <product> is for, and how its parts fit.

## What it is        one paragraph: the problem, who has it, what the product does
## Who it is for
## What it is not    the things people will assume it does
## Status            live, beta or idea; where users are
```

**Glossary** (`wiki/concepts/glossary.md`): a table of `Word | Means here | Not to be
confused with`, one row per word, in A–Z order.

**Rule** (a concept that must hold):

```markdown
## 1. No data, no answer
Every claim needs a fact with a source and a date.
- **Breaks it:** an answer that states something with no source.
- **Check:** each claim names its fact.
```

**Decision** (`wiki/decisions/<topic>.md`):

```markdown
---
last-verified: 2026-10-27
---
# Pricing
**Choice:** annual plan only, ₹249 ([plan-pro](../entities/plan-pro.md)) (owner, 2026-06-30).
**Why:** monthly churn was 3× annual in the 2026-06 test.
**Rejected:**
- Monthly plan: churn.
- Lifetime deal: no recurring revenue.
**Revisit:** if annual churn passes 5% a month.
```

When the choice changes, overwrite the file. Keep `Rejected:`: it stops the same idea
coming back. `Revisit:` is optional and names the fact that would reopen it; `weigh`
pushes back on a rejected option until that fact holds. Fix lists go in commits or
`CHANGELOG.md`, not here.

**Research** (`wiki/synthesis/`): `## Finding` (one paragraph) · `## Proof` (how it
was found, with dates) · `## Verified by` (who, or "nobody") · `## What it means`.

## Indexes and READMEs

- `.context/README.md` is a "start here": the pages to read, in order, then a table
  of folders. It names only folders the repo has.
- `wiki/index.md` has one line per page, grouped by folder: the link, then what the
  page decides or explains.

## Checked by `canon check`

`wiki-frontmatter` (`last-verified`, placeholders, stale after 90 days) ·
`context-size` (caps, dated names) · `canonical-values` (a price in a decision or
screen note is held by an entity) · `refs` (links and `.context/` paths resolve) ·
`drift` (a page's named files exist and have not changed since `last-verified`) ·
`sources`.
