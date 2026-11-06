---
last-verified: 2026-11-02
---
# Rule layers

**Choice:** a repo builds on named files with `extends:`, furthest first:
organization, product, team. Then its own `context.yaml`, then the uncommitted
`context.local.yaml`. The closest wins, unless a higher layer put the key under
`locked:` (shipped in 0.27.0, 2026-11-02; who: not recorded).
- Single values replace.
- Lists with IDs merge by ID.
- A named pipeline replaces only that name.
- Standards replace by file name.
- Principles only add.

**Why:** one company has many products and teams. Each sets its own rules, while a
few, like security review, stay fixed. Files in git keep rules reviewable.

**Rejected:**
- Finding rule files by walking up folders (the old estate layer, removed in
  0.18.0): which rules apply would depend on where a repo is checked out.
- A server as the only home of company rules: the free edition must work alone.
- Layers that cannot be locked: nothing a company requires would hold.
