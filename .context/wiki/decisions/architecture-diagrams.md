---
last-verified: 2026-10-30
---
# Architecture page

**Choice:** each repo has one `.context/architecture/architecture.json`. `canon ui`
draws it as one page under Architecture in the shell's top bar: how the parts fit,
what they cost, what grows the bill, what breaks and what is not known. Agents read
the same file and `canon check` verifies it. Format: the `architecture-page` standard.

**Why:** diagrams of folders told nobody anything; the owner needs architecture and
cost. Every figure carries a basis and a source, so a guess cannot pass for a fact.

**Rejected:**
- Four diagrams per repo, one tab each (0.24.0): they repeated the folder structure,
  at 800 KB of HTML each, and were replaced the same day.
- Markdown copies of the data: a second source that drifts (C-02).

**Cost:** the file is written from research, not generated, so it goes stale; the
check warns after 90 days. Only `canon ui` shows it, because a browser refuses
`fetch` on `file://`.
