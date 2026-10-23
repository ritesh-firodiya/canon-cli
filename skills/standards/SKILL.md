---
name: standards
description: Load the standards that cover the work before doing it — the repo's design rules, code standards, .context layout, wiki schema, agent contract, and any team-specific rules. Use before creating or changing designs, code, .context/ files, wiki pages, store listings, or anything a team rule might govern, and when asked "what are the rules for…".
---

# Load the standards that apply

1. List them: run `zeno standards` in the repo. It prints every standard that
   applies — zeno's defaults, then the team's and the repo's own (a team file
   with the same name replaces zeno's). If the `zeno` CLI is not installed, use
   the files in `../../standards/` (relative to this skill).
2. Read only the ones that cover this work: designs, code, `.context/`, wiki,
   listing, secrets — judge from the file names, then their first lines.
3. Follow them. Where two disagree, the more specific one (the repo's, then the
   team's, then zeno's) wins; say which one you followed.
4. Before calling the work done, run `zeno check` and report its result.
