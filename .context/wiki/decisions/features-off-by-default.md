---
last-verified: 2026-11-02
---
# Features off by default
**Choice:** a new install turns on only the band, showing usage, cache and extend. Everything else is off until a repo turns it on with `canon enable <feature>` or `features:` in `.context/context.yaml`: `routing`, `process` (weigh, decisions, standards, session-start text, work facts on the band), `knowledge` (search, ask, ingest), `styles`. A command you type still runs: off means nothing happens on its own. The plugin splits in two, `canon` for the band and `canon-tools` for the rest, because Claude Code loads skills and MCP servers from a plugin, so a setting cannot hide them.
**Why:** the owner, 2026-11-02: "by default canon should only enable band, every other feature needs to be disabled". Each thing moved out also cuts startup tokens for everyone.
**Rejected:** one plugin with a setting (it cannot hide skills or search) · on by default with an off switch (the owner's call) · a `canon link` per product (the band follows the work).
