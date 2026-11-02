---
id: BUG-0006
status: open
severity: high
priority: p1
last-verified: 2026-11-02
source: found verifying 2.1.1
---
# Design sets on disk are stuck on the 0.30.0 shell

## Summary
Each set's `shell.js` points at `@freetesh/canon@0` on unpkg, as `standards/library/design-sets.md` says. Since 1.0.0 that resolves to the last 0.x release, 0.30.0, so no shell fix reaches a set opened from `file:///`.

## Expected
A release needs no edit in any set, as the standard promises.

## Actual
`https://unpkg.com/@freetesh/canon@0/shell/crawl.js` redirects to 0.30.0. All 16 sets hold the pin. `canon ui` is not affected, since it serves its own shell.

## Evidence
- Scratch copy of the Canon set with the pin changed to 2.1.1: the fixes from BUG-0003 work on `file:///`. With `@0` they do not.
