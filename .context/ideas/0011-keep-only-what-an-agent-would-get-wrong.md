---
id: IDEA-0011
status: shipped
last-verified: 2026-11-02
problems: PROB-0003
source: backfill
---
# Keep only what an agent would get wrong

## Summary
One test for every wiki line: keep it only if an agent would make a mistake without it. Cut the schema to that test and a few folders, add caps with the `context-size` check, and keep open work only in `tasks.md`. The current rules are in `standards/wiki-schema.md`.

## Evidence
- 4d4bf10: the cut, 18 files
- 2f7973d: one decision file per topic
- 8a6888b: released as 0.11.0
