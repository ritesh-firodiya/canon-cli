---
id: FEAT-0029
type: feature
status: planned
priority: p2
last-verified: 2026-11-04
release: null
surfaces: []
plan: PLAN-0003
---
# Knowledge gate

## Summary
Before an agent writes a page under `.context/`, the band runs `canon gate`: every page rule the repo has, on the repo as it is and as it would be with the page. What the page newly breaks refuses the write, and the agent is told to fix it or propose it to the person. The new `one-home` check reports a fact written in two pages.

## Motivation
Knowledge must grow without junk: well structured, one home per fact (C-02), no conflicts, within size caps. `canon check` found these only after the fact.

## Acceptance scenarios
- Given a Write or Edit of a markdown page under `.context/` (not `designs/` or `packs/`), then `canon gate` judges it before it is written.
- Given a page that repeats a sentence of 60 or more characters from another page, then the gate refuses it, naming that page.
- Given a page with no frontmatter, a missing field, or over its line cap, then the gate refuses it.
- Given an edit to a page that already breaks a rule, then only what the edit adds is judged.
- Given no canon, or a canon without the gate, then the write goes on and `canon check` judges it later.
- Given the gate, then nothing is written to the repo while it runs.

## Out of scope
- Facts that conflict in meaning but not in words: `canonical-values` covers values; meaning needs a model.
- A session budget for knowledge read: PLAN-0003 step 8.

## Open questions

## Store copy
> canon now checks every page before it is written to your knowledge, and refuses repeats and broken pages.
