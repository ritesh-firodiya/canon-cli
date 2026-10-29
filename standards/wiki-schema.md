# Wiki — rules

`.context/wiki/` holds what an agent would get wrong without being told. `.context/raw/` holds
sources, never edited. Answer from the wiki, not from raw.

## The test

Keep a line only if an agent would make a mistake without it. Never write what the
code, an HTML design, or `git log` already says. Describe what is true **now**:
history is git's job.

## Folders

| Folder | Holds | Example |
|---|---|---|
| `concepts/` | a rule or invariant | `money-in-minor-units` |
| `entities/` | canonical values (prices, SKUs, limits) — the one home for each | `plan-pro` |
| `decisions/` | one file per topic: the current choice | `pricing` |
| `surfaces/` | a screen's notes: what its HTML can't show (only screens that have some) | `paywall` |
| `synthesis/` | research and cross-cutting analysis | `tax-table-verification-ay-2026-27` |

There is no page per screen: the HTML design is the screen spec. A screen gets a
`surfaces/<slug>.md` only when it has a constraint or decision invisible in its pixels;
the design set's notes button shows it, and `routes.js` sets `notes: null` for every
other screen. A user journey worth keeping is a concept.
A product may add a folder in `.claude/canon.yaml` under `wiki.types`, with a reason.

## Pages

- Frontmatter: `last-verified: YYYY-MM-DD` is the only required field. `id` is kept
  where code references it (`SOURCE.*`, entity keys).
- Write only the sections you have something to say in. No `TBD`, no `none yet`.
- One file per topic, edited in place. No dated names, no `v2`, no supersede chains.
- Caps: page 60 lines, decision 30. Synthesis is exempt.
- Link with `[[slug]]` (the file name without `.md`). `index.md` is one line per page.

## Decisions

```markdown
---
last-verified: 2026-10-27
---
# Pricing
**Choice:** annual plan only, ₹249 ([[plan-pro]]).
**Why:** monthly churn was 3× annual in the 2026-06 test.
**Rejected:** monthly plan (churn) · lifetime deal (no recurring revenue).
```

When the choice changes, overwrite the file. `Rejected:` is what stops the same idea
being proposed again; keep it. A deferred option adds one `**Revisit:**` line: the
fact that would reopen it. `weigh` pushes back on a rejected option until that fact holds. Fix lists and audit results go in commit messages or
`CHANGELOG.md`, not here.

## Data sources

Each tool that holds product data is one entity page, `id: SOURCE.<NAME>`, with a
`## How to query` section and a `SOURCE.<NAME>.ACCESS` row: `mcp: <server>`,
`skill: <name>`, `cli: <command>` (also listed in `doctor.tools`) or `manual: <where>`.
Queries are read-only, one or two per claim, with a row limit. Save counts and
rates to `raw/YYYY-MM-DD-<source>-<slug>.md`, never rows that name a person. Never
put a key or token on the page.

## Not for

Code docs (they go next to the code) · tasks (`tasks.md`) · plans (`features/`) ·
chat logs · session notes · changelogs.

## Checked by `canon check`

`wiki-frontmatter` (last-verified, placeholders, stale > 90 days) · `context-size`
(caps, dated decision names, no `flows/`) · `canonical-values` (a
price in a decision or screen note is held by an entity) · `sources`.
