---
name: design-set-without-shell-js
status: done
last-verified: 2026-11-02
outcome: discarded
source: backfill
---
# design-set-without-shell-js

## Summary
In 0.22.0 a design set held none of canon's shell, not even `shell.js`, so no set pinned a canon version. `canon ui` served the shell.

## Hypothesis
Not written down at the time.

## Metric
None recorded.

## Result
Reversed one release later. A page opened from disk had no shell, so 0.23.0 put back one `shell.js`, canon's loader on a floating major version. Sets open from `file:///` again and nothing needs bumping per release. The current rule is in `standards/`, under `design-sets`.

## Evidence
- 6bfa171: 0.20.0, the pinned loader
- 082f421: 0.22.0, no `shell.js`
- c4dc913: 0.23.0, loader back
- `CHANGELOG.md`, 0.22.0 and 0.23.0
