---
last-verified: 2026-10-30
---

# Architecture diagrams

**Choice:** each repo's diagrams are `.context/architecture/<question>.json`, the
only source. `canon ui` draws them under an Architecture item in the shell's top
bar, agents read them, and `canon check` verifies them. Why a part was chosen stays
in a wiki concept page.

**Why:** the wiki site and the canon app never showed them, and search skipped
them. Each diagram was a 1 KB JSON file beside an 800 KB generated HTML file, 47 MB
across 16 repos. One file serves people, agents and the check.

**Rejected:**
- Markdown copies: a second source that drifts (C-02).
- Keeping Archify's HTML in a frame: two copies of every diagram, and the 47 MB.

**Cost:** no Archify toolbar, animation or image export, and canon keeps a small
drawing routine. Only `canon ui` shows the view, because a browser refuses `fetch`
on `file://`.
