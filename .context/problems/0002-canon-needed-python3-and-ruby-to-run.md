---
id: PROB-0002
status: solved
source: backfill
priority: p2
last-verified: 2026-11-02
---
# Canon needed python3 and Ruby to run

## Summary
Design checks needed python3, and `canon flow` needed python3 and read `release.yml` with Ruby. A package installed from npm depended on tools npm does not install.

## Impact
`canon doctor` had to check for python3, and design checks depended on it.

## Expected
canon needs only Node, git and qmd.

## Evidence
- `CHANGELOG.md`, 0.17.0, 0.18.0 and 0.21.0
- 25c2d10, 4c888bf: the ports
