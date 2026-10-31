---
last-verified: 2026-10-31
---

# Config location

**Choice:** a repo's canon config is `.context/context.yaml`, with an uncommitted
override at `.context/context.local.yaml`. These are the only files besides
`README.md` and `tasks.md` allowed at the `.context/` root. An old
`.claude/canon.yaml` is an error.

**Why:** the owner wants the config with the rest of the repo's context. The old
path came from canon's start as a Claude Code plugin, and canon is now also a
standalone CLI.

**Rejected:**
- `.claude/canon.yaml` — ties a standalone CLI to one assistant's folder.
- `.canon/canon.yaml` — one more top-level folder.
- `.context/index.yaml` — `wiki/index.md` already means a table of contents.
- Reading the old path as a fallback — two homes for one fact (C-02), and without
  the error a repo not moved would silently run on inferred defaults.
