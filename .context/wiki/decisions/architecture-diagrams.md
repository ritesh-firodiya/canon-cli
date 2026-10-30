---
last-verified: 2026-10-30
---

# Architecture page

**Choice:** each repo has one `.context/architecture/architecture.json`, drawn by
`canon ui` as one page under Architecture in the shell's top bar: how it fits
together, what it costs, what grows the bill, what breaks and what is not known.
Agents read the same file, and `canon check` verifies it. Format: `architecture-page`.

**Why:** diagrams of folders told nobody anything. What the owner needs is
architecture and cost. Every figure carries a basis and a source, so a guess cannot
pass for a fact, and an unknown is shown as unknown.

**Rejected:**
- Four Archify diagrams per repo (0.24.0): they repeated the folder structure, at
  800 KB of HTML each.
- Markdown copies of the data: a second source that drifts (C-02).

**Cost:** the file is written from research, not generated, and goes stale; the
check warns after 90 days. Only `canon ui` shows the view, because a browser refuses
`fetch` on `file://`.
