---
name: ingest
description: Turn a raw source (wireframe, meeting note, research doc) — or, with no argument, what this session taught — into wiki pages that pass the admission test, and update .context/wiki/index.md. Usage `/ingest [path-to-raw-file]`.
---

You are ingesting a raw source into the wiki at `.context/wiki/`.

Source to ingest: `$ARGUMENTS`

## Steps

1. **Read the wiki schema (the `wiki-schema.md` that `canon standards` lists — a team's own replaces canon's; without the CLI, `../../standards/wiki-schema.md` relative to this skill) first.** It defines the folders, the one test for what belongs, and the caps. Every page you write must conform.

2. **Read the raw source** at the path in `$ARGUMENTS`. Accepted: anything under `.context/raw/` or `.context/designs/`, and application source in this repository. Refuse paths outside the repo.
   With no argument, the source is this session: list what it established that a later agent would get wrong without (a rule, a value, a choice and what was rejected). Search the wiki first and update a page rather than add one. Show the proposed changes and stop; write only when the user says so.

3. **Classify** the source into one or more wiki page types:
   - HTML wireframe → nothing; the HTML is the spec. Only a constraint it can't show becomes that screen's `surfaces/<slug>.md` note.
   - Decision note → the `decisions/<topic>.md` file, via the `decision` skill's format
   - Research doc / interview → typically `concept` pages (split if it covers multiple ideas), or one `synthesis` page for a brief that draws a conclusion
   - A new tier / product / canonical value → `entity` page
   - A user journey description → a concept, only if it holds a rule the designs don't show
   - Write nothing an agent could read from the code, the designs or git.
   - Don't force one source into one page — a meeting note can produce multiple pages.
   - Folders are the four in the schema plus any listed under `wiki.types` in the repo's `.context/context.yaml`, each with its folder and its required `sections` (use its `sections` headings). Use an added type only when the source fits it.

4. **For each page you will create:**
   - Filename: the topic, lowercase kebab-case, no date.
   - Check whether a page on the topic already exists. If yes, edit it in place and refresh `last-verified` to today. Keep any `id`.
   - Write only sections with something to say. No placeholders. Stay under the caps (page 60 lines).
   - Link related pages with `[[slug]]` where it helps a reader. List the source path under `Sources`.

5. **Update `.context/wiki/index.md`:** one line for the new page, under its folder heading, alphabetical. Don't reformat existing entries.

6. **Leave the source where it is.** `.context/raw/` is immutable: a source is "processed" when a wiki page lists it under `Sources`, not when it moves.

7. **Report**: list each page created or updated with its ID and path. Flag any `[[wikilinks]]` to non-existent pages as "TODO targets".

## Rules

- Never edit anything under `.context/raw/` or `.context/designs/`.
- Never delete or rename an existing wiki page from this skill.
- Never invent canonical values. If the source has a price/string/enum, copy it verbatim; if it's ambiguous, ask the user before writing.
- Follow the copy rules from the root `CLAUDE.md` for any user-facing strings you transcribe.
- Today's date is in the session context — use it for `last-verified`.
