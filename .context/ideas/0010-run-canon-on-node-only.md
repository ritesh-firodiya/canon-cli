---
id: IDEA-0010
status: shipped
last-verified: 2026-11-02
problems: PROB-0002
source: backfill
---
# Run canon on Node only

## Summary
Port the design checks and `canon flow` from Python to TypeScript, read `release.yml` with the yaml package, and drop `canon arch-set` instead of porting it, since it wrote to a format no set used any more. Sets still on `routes.js` stopped being checked.

## Evidence
- 25c2d10, 4c888bf: the ports
- 75e51ce: `canon arch-set` removed
- 8bd7b6e: released as 0.21.0
