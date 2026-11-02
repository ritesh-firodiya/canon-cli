---
name: stage-and-experiment-shapes-0-27-0-28
status: done
last-verified: 2026-11-02
outcome: discarded
source: backfill
---
# stage-and-experiment-shapes-0-27-0-28

## Summary
Two shapes tried on the way to the current flow. In 0.27.0 experiments were `EXP-NNNN` records and any record could set `experiment: true`. In 0.28.0 `research` and `code` were replaced by `development` and a `poc` stage, and no record folder was required.

## Hypothesis
Not written down at the time.

## Metric
None recorded.

## Result
All reversed in 0.29.0, the same day. `research` and `code` came back, `development` and `poc` went, experiments became `experiments/<name>.md`, and `features/` is required again unless a repo removes it. Why is in the Rejected line of [[work-records]].

## Evidence
- 14fc997: 0.27.0
- d7da54d: 0.28.0
- 7317672: 0.29.0
- `CHANGELOG.md`, 0.27.0 to 0.29.0
