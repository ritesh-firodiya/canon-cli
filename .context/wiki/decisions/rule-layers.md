---
last-verified: 2026-11-02
---
# Rule layers
**Choice:** a repo builds on named files with `extends:`, furthest first: organization, product, team. Then comes its own `context.yaml`, then the uncommitted `context.local.yaml`. The closest wins, unless a higher layer put the key under `locked:`. Single values replace, lists with IDs merge by ID, a named pipeline replaces only that name, standards replace by file name, and principles only add.
**Why:** one company has many products and teams, and each must set its own rules while a few, like security review, stay fixed. Files in git keep rules reviewable.
**Rejected:** finding rule files by walking up folders (which rules apply would depend on where a repo is checked out) · a server as the only home of company rules (the free edition must work alone) · layers that cannot be locked (nothing a company requires would hold).
