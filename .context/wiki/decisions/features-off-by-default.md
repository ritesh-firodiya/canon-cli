---
last-verified: 2026-11-02
---
# Features off by default

**Choice:** a new install turns on only the band (usage, cache, extend). Everything
else is off until turned on (owner, 2026-11-02):
- per repo: `canon enable <feature>` or `features:` in `.context/context.yaml`;
- per person: `--user`, kept in `~/.canon/features.json`, never committed.

Features: `routing`, `process` (weigh, decisions, standards, session-start text),
`knowledge` (search, ask, ingest), `styles`. A command you type still runs; off
means nothing runs on its own. Each feature is its own plugin under `plugins/`,
because Claude Code loads skills and MCP servers per plugin and a setting cannot
hide them.

**Why:** the owner said "by default canon should only enable band". Each feature
moved out also cuts startup tokens for everyone.

**Rejected:**
- One plugin with a setting: it cannot hide skills or search.
- One `canon-tools` plugin: enabling one feature would bring them all.
- Several plugins sharing the repo root: tested 2026-11-02, they do not load.
- On by default with an off switch: the owner's call.
- A `canon link` per product: the band follows the work.
