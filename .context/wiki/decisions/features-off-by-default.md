---
last-verified: 2026-11-02
---
# Features off by default
**Choice:** a new install turns on only the band, showing usage, cache and extend. Everything else is off until a repo turns it on with `canon enable <feature>` or `features:` in `.context/context.yaml`: `routing`, `process` (weigh, decisions, standards, session-start text, work facts on the band), `knowledge` (search, ask, ingest), `styles`. `--user` turns one on across a person's machine, kept in `~/.canon/features.json` and never committed, and it adds to what a repo names. A command you type still runs: off means nothing happens on its own. The plugin splits: `canon` is the band; `canon-process`, `canon-knowledge` and `canon-styles` each live under `plugins/` and `canon enable` installs one for the repo, because Claude Code loads skills and MCP servers from a plugin, so a setting cannot hide them.
**Why:** the owner, 2026-11-02: "by default canon should only enable band, every other feature needs to be disabled". Each thing moved out also cuts startup tokens for everyone.
**Rejected:** one plugin with a setting (it cannot hide skills or search) · one `canon-tools` plugin (enabling one feature would bring them all) · several plugins sharing the repo root (tested 2026-11-02: they do not load) · on by default with an off switch (the owner's call) · a `canon link` per product (the band follows the work).
