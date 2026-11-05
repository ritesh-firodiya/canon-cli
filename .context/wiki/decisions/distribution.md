---
last-verified: 2026-11-02
---
# Distribution

**Choice:** two repos.
- `canon-cli`: public, MIT. The CLI, the Claude Code plugins, the standards, packs
  and the search server. Ships as `@freetesh/canon` on npm and installs as a plugin
  from this repo. Whatever runs on one machine from the repo belongs here.
- The knowledge site: private and paid. It depends on `@freetesh/canon` and holds no
  copy of it. Whatever needs a server or other people belongs there.

**Why:** the plugin and the npm package need a public repo. The site is what people
pay for: every repo in one place, with search and editing for a team. Paying demand
is not proven ([[hosted-team-version-only-enforcement-has-a-clear]]).

**Rejected:**
- One private repo: the plugin cannot install and npm stops updating.
- One public repo with a paid folder: the site's source would be public.
- Copying the CLI into the site's repo: two copies drift (C-02).
