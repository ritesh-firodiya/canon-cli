---
id: BUG-0007
status: open
severity: low
priority: p3
last-verified: 2026-11-02
source: found verifying 2.1.1
---
# canon update reformats context.yaml

## Summary
`canon update` rewrites the whole file through `document.toString()` in `cli/src/sync/sync.ts`, so a one-line entry is split and long lines fold. The values stay the same. 2.0.1 fixed this for `canon enable` only.

## Expected
Only the `canon:` line changes.

## Actual
The `marketing` stage entry grew from one line to nine.

## Evidence
- Seen running `canon update` in this repo on 2.1.1.
