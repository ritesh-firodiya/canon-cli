---
id: PROB-0003
status: solved
source: backfill
priority: p2
last-verified: 2026-11-02
---
# The wiki grew past what an agent needs

## Summary
The wiki schema had reached 299 lines, with required sections, a page per screen, flow pages and dated decisions with supersede chains. The reason for the cut was not written down beyond the rule it set: keep only what an agent would get wrong without it.

## Impact
No measurement was recorded.

## Expected
The schema stays short, `last-verified` is the only required field, and decisions are one file per topic, overwritten when the choice changes.

## Evidence
- `CHANGELOG.md`, 0.11.0: 299 lines down to 70
- 4d4bf10, 2f7973d
- `standards/wiki-schema.md`
