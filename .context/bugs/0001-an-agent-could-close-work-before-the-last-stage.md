---
id: BUG-0001
status: fixed
severity: high
priority: p2
last-verified: 2026-11-02
source: backfill
---
# An agent could close work before the last stage

## Summary
Found by running the published 0.28.0 through the real default flow with Claude. An agent closed a problem during review, with gates still ahead of it.

## Expected
Only the last stage closes a record, and it closes everything made for that record.

## Actual
An agent could close a record at any stage, which skipped the remaining gates.

## Evidence
- 2dde912: the fix, with `cli/test/run.test.ts`, released as 0.28.1. The commit does not show that the test failed first.
