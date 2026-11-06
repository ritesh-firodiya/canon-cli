---
id: FEAT-0014
type: feature
status: shipped
priority: p2
last-verified: 2026-11-07
release: 4.0.0
surfaces: []
plan: PLAN-0003
---
# Knowledge beside each prompt

## Summary
On each typed prompt in a product with `knowledge` on, the band searches the product's qmd collection for the prompt's telling words and attaches up to three pages, by title and path, that match at least two of them. It logs what it attached and what the agent opened to `~/.canon/knowledge.jsonl`.

## Motivation
PROB-0001: searching the knowledge before answering was only asked. Now the pages that apply are in front of the agent on every prompt, and nobody chooses them.

## Acceptance scenarios
- Given a typed prompt where `knowledge` is on, then each of its five longest words (four letters or more, not common words) is searched with `qmd search` in that product's collection, at once.
- Given two or more words, then only a page that matches two is attached; with one word, its best page.
- Given hits, then the prompt carries a note with each page's title and path, and no page text.
- Given no hits, no qmd, a slash command or a mod's message, then nothing is attached.
- Given the agent reads an attached page, then that is logged.

## Out of scope

## Open questions

## Store copy
> Each prompt now carries the pages of your knowledge that its words point to.

## Verdict
- 2026-11-06 · push-back · overridden · C-01 · Build FEAT-0014; found already built
  - Reason: agree to 1-3
  - Term: FEAT-0014 shipped (4.0.0), index updated
  - Term: PLAN-0003 steps 1 and 2 done; step 3 open
  - Term: Spec says longest words, not rarest
