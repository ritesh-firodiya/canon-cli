---
name: decision
description: Record a product or technical decision as a new ADR page in .context/wiki/decisions/. Usage `/decision <title> — <body>`.
---

You are logging a decision as a new `.context/wiki/decisions/<YYYY-MM-DD>-<slug>.md` page.

Decision to record: `$ARGUMENTS`

## Steps

1. Read the wiki schema (`../../standards/wiki-schema.md`, relative to this skill) § "`decision`" for the frontmatter and the required sections. If `.context/wiki/decisions/` already holds pages, open a recent one and match it.

2. Parse `$ARGUMENTS`:
   - If it contains ` — ` (em-dash with spaces), split on the first occurrence: left = title, right = body.
   - Otherwise treat the whole string as the title; body = "(no detail provided)".

3. Derive the filename:
   - Date = today's `currentDate` from the session context (`YYYY-MM-DD`).
   - Slug = kebab-case of the title, lower-cased, alphanumerics + hyphens only, ≤ 60 chars.
   - Path = `.context/wiki/decisions/<date>-<slug>.md`. If a file at that path already exists, append `-2`, `-3`, etc.

4. Write the new ADR with the standard frontmatter and the body the user provided. Do not summarise or shorten the body.

5. Add the page to `.context/wiki/index.md` under Decisions.

6. Confirm: `decision logged: "<title>" → <path>`.

## Rules

- One decision per file. Never append to an existing ADR.
- Do not edit any other wiki page in the same command — if cross-references are needed, surface them in the body as `[[wikilinks]]`, but leave the target pages alone.
- The wiki is the only source of truth for decisions. There is no monolithic decision log.
