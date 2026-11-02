---
id: FEAT-0022
type: feature
status: planned
priority: p2
last-verified: 2026-11-02
release: null
superseded-by: null
surfaces: []
plan: PLAN-0001
---

# Session defaults

## Summary
Compact instructions, a smaller startup and three output styles, so each session rereads less and answers at the size asked for.

## Motivation
Cache rereads are most of the cost, and every reply rereads what loaded at startup.

## Acceptance scenarios
- Given a new repo, when `canon init` runs, then its `CLAUDE.md` has a `# Compact instructions` section that keeps decisions, open tasks, file paths and failed attempts.
- Given the canon plugin, then `short`, `normal` and `detail` output styles are available, and switching keeps the cache.
- Given `/context` and `canon usage`, then the owner sees what could be turned off before anything changes.
- Given the approved trim, then context at the first reply is lower than the baseline.

## Out of scope
- Removing a plugin or skill without the owner's approval.

## Open questions
- Which plugins and skills go. The usage report decides.

## Store copy
> Sessions keep what matters when they compact, and answer at the size you pick.
