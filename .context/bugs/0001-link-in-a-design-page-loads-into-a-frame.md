---
id: BUG-0001
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
- Tried on the Canon design set, `web/site/home.html`, in Chrome: on `canon ui`, and on `file:///` with the 0.30.0 and 2.1.1 shells. Each click made one top-level navigation and left the page on its target.
- Needs the page and link that does it.
