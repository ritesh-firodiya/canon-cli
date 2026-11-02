---
name: evals-on-real-product-repos
status: done
last-verified: 2026-11-02
outcome: discarded
source: backfill
---
# evals-on-real-product-repos

## Summary
Plugin evals that scaffolded from real product repos, beside the fixture-product evals. Added in 0.18.0.

## Hypothesis
Not written down at the time.

## Metric
None recorded.

## Result
Removed in 0.21.0, with their scaffold. The fixture-product evals stayed. The reason was not written down at the time. The same day, 6c4278b added a test that fails when a tracked file names a sibling repo, and these cases did name them.

## Evidence
- a685295: added
- bc505d8: removed
- 6c4278b: the naming test
- `CHANGELOG.md`, 0.18.0 and 0.21.0
