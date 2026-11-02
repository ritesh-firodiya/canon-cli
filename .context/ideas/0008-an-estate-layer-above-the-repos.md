---
id: IDEA-0008
status: dropped
last-verified: 2026-11-02
problems: PROB-0004
source: backfill
---
# An estate layer above the repos

## Summary
One shared config above all repos: it defined copy sets and pipelines, and products inherited from it.

## Verdict
Dropped in 0.18.0. `estate: true` became an error and `canon add --global` went away. Shared rules are now imported by name, or built with `extends:`, as [[rule-layers]] describes. Do not bring back rules found from the surrounding folder.

## Evidence
- `CHANGELOG.md`, 0.13.0, 0.15.0 and 0.18.0
- 645bcf1: estate scripts became checks
- a685295: the layer removed
