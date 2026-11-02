---
id: BUG-0002
status: fixed
severity: medium
priority: p2
last-verified: 2026-11-02
source: backfill
---
# Architecture starter hid npm imports and turned rules off

## Summary
The dependency-cruiser starter excluded `node_modules` and every `dist/` folder. That hid all npm imports and silently turned off rules such as `no-non-package-json`. A TypeScript workspace where no `.ts` file was read also passed.

## Expected
Rules see npm imports, and a workspace with no `.ts` file read gets a warning.

## Actual
The checks passed with those rules off.

## Evidence
- 9021d77: the fix, with `cli/test/checks/architecture.test.ts`. The commit does not show that the test failed first.
