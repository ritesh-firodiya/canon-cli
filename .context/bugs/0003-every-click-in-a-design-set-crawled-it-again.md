---
id: BUG-0003
status: fixed
severity: medium
priority: p2
last-verified: 2026-11-02
source: user report
---
# Every click in a design set crawled it again

## Summary
Each link followed inside a page is a new document, and each new document loaded every page and component of the set in hidden frames before the shell drew. On a 51-page set that was 51 frames per click, and slower still from `file:///`, where the shell comes from the published package.

## Expected
Moving between pages is quick. Only opening the Journey reads the set again.

## Actual
Every page view waited for a full crawl.

## Evidence
- `cli/test/shell-state.test.ts`: a page reuses the crawl the journey stored and loads no frame. It failed before the change.
- In `canon ui` on a 51-page set, a page opened after the Journey loaded in 181 ms with no frames.
- Fixed in `shell/crawl.js`. The crawl is kept in `sessionStorage`, so a changed page shows after the Journey is opened again.
