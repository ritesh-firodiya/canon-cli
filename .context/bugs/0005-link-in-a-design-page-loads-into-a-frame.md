---
id: BUG-0005
status: open
severity: medium
priority: p2
last-verified: 2026-11-02
source: user report
---
# A link inside a design page "goes back and loads into the frame"

## Summary
Reported on `canon ui`'s Pages view: a click on a link in the page works, but then the shell goes back and loads the page into a frame.

## Expected
A link opens its page in the shell, once.

## Actual
Not reproduced. In `canon ui`, a link in a page opened its target normally and the shell drew once, with no frame.

## Evidence
- Tried on the Canon design set, `web/site/home.html` to `web/site/install.html`, in Chrome. No `file:///` run, where the shell comes from the published package.
- Needs the page and link that does it, and whether it was `file:///` or `canon ui`.
