---
id: FEAT-0006
type: feature
status: shipped
priority: p2
last-verified: 2026-11-02
release: 0.30.0
superseded-by: null
surfaces: []
plan: PLAN-0001
---

# Session defaults

## Summary
Compact instructions, a smaller startup and two output styles, so each session rereads less and answers at the size asked for.

## Motivation
Cache rereads are most of the cost, and every reply rereads what loaded at startup.

## Acceptance scenarios
- Given the owner's global `CLAUDE.md`, then its `# Compact instructions` section keeps decisions, open tasks, file paths and failed attempts. A hook cannot set this: `PreCompact` can only block.
- ~~Given the canon plugin, then `short` and `detail` output styles are available.~~ Removed in 4.0.0: the band's reply size (S, M, L) replaced them.
- Given `/context` and `canon learn --cost`, then the owner sees what could be turned off before anything changes.
- Given the approved trim, then context at the first reply is lower than the baseline.

## Out of scope
- Removing a plugin or skill without the owner's approval.

## Open questions
- Which plugins and skills go. The usage report decides.

## Store copy
> Sessions keep what matters when they compact, and answer at the size you pick.
