---
last-verified: 2026-10-31
---
# Config location

**Choice:** a repo's canon config is `.context/context.yaml`, with an uncommitted
override at `.context/context.local.yaml` (owner, 2026-10-31).

**Why:** the owner wants the config with the rest of the repo's context. The old
path came from canon's start as a Claude Code plugin.

**Rejected:**
- `canon.yaml` in `.claude`: ties a standalone CLI to one assistant's folder.
- `canon.yaml` in a `.canon` folder: one more top-level folder.
- `.context/index.yaml`: `wiki/index.md` already means a table of contents.
- Reading the old path as a fallback: two homes for one fact (C-02), and a repo not
  moved would run on guessed defaults without a word.
