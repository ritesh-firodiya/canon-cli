---
id: BUG-0004
status: fixed
severity: low
priority: p3
last-verified: 2026-11-02
source: user report
---
# A design set's theme came from another product

## Summary
The shell kept the viewer's light/dark choice under one key. `file:///` and `canon ui` serve every product from one origin, so a choice made in one product set the starting theme of the others.

## Expected
A set starts from the first theme in its own `design.js`, until the viewer picks one in that set.

## Actual
It started from whatever any product last saved.

## Evidence
- `cli/test/shell-state.test.ts`: a product's own saved choice is used, and another product's is not. The first failed before the change.
- Fixed in `shell/theme.js` and `shell/shell.js`: the key is now `babul-theme:<product name>`.
