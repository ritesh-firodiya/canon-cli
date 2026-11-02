---
id: PROB-0004
status: solved
source: backfill
priority: p2
last-verified: 2026-11-02
---
# A repo's rules depended on a parent folder

## Summary
Before 0.18.0 canon read a config above the repo, called the estate. Which rules applied to a repo depended on the folder around it. The reason for removing it was not written down at the time. A later decision gives the same objection, in [[rule-layers]].

## Impact
A repo's rules could not be read from the repo alone.

## Expected
Every repo carries its own rules, and canon never reads a config above the repo.

## Evidence
- `CHANGELOG.md`, 0.15.0 and 0.18.0
- a685295: the layer removed
- `.context/wiki/decisions/rule-layers.md`
