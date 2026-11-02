---
id: FEAT-0023
type: feature
status: planned
priority: p2
last-verified: 2026-11-02
release: null
superseded-by: null
surfaces: []
plan: PLAN-0001
---

# Wildcard ideas

## Summary
A `wildcard` skill makes sure a set of ideas is not only copied from what already worked: of every 10, 8 follow the references and 2 break them.

## Motivation
References and `weigh` both pull toward what exists, so new ideas get rarer over time.

## Acceptance scenarios
- Given a request for ideas, then 2 of every 10 are wildcards, and each says which reference it breaks.
- Given a wildcard kept as an idea, then its record has `wildcard: true`.
- Given a wildcard the owner likes, then the skill offers to add it to the references.
- Given a wildcard that moves on, then every later gate applies to it as usual.

## Out of scope
- Loosening `weigh` or any approval gate.
- Changing the standards, unless the owner says so.

## Open questions
- Whether the default flow's `idea` stage calls this skill, or the owner calls it by hand. That depends on FEAT-0020.

## Store copy
> Ask for ideas and get some that break your own patterns.
