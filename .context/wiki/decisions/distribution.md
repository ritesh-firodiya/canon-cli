---
last-verified: 2026-11-02
---

# Distribution

**Choice:** two repos. `canon-cli` is public and MIT: the CLI, the Claude Code
plugin, the standards, packs and the search server. It ships as
`@freetesh/canon` on npm and installs as a plugin from this repo. The knowledge
site (the UI) is private and paid; it depends on `@freetesh/canon` and holds no
copy of the CLI. What runs on one machine from the repo belongs here, including
the pipeline format, local runner and read-only connectors. What needs a server
or other people belongs in the site.

**Why:** the plugin and npm package need a public repo. The UI is what people
pay for: every repo in one place, search and editing for a team.

**Rejected:**
- One private repo for everything — the plugin cannot install and the npm
  package stops updating.
- One public repo with a paid folder — the UI source would be public.
- Copying the CLI into the UI repo — two copies drift (C-02).
