---
name: ingest
description: Read a raw source (wireframe, meeting note, research doc) and draft the wiki page(s) that summarise it. Adds frontmatter, [[wikilinks]], and updates .context/wiki/index.md. Usage `/ingest <path-to-raw-file>`.
---

You are ingesting a raw source into the wiki at `.context/wiki/`.

Source to ingest: `$ARGUMENTS`

## Steps

1. **Read the wiki schema (the `wiki-schema.md` that `zeno standards` lists — a team's own replaces zeno's; without the CLI, `../../standards/wiki-schema.md` relative to this skill) first.** It defines page types, frontmatter, required sections, ID conventions, and lint rules. Every page you write must conform.

2. **Read the raw source** at the path in `$ARGUMENTS`. Accepted: anything under `.context/raw/` or `.context/designs/`, and application source in this repository. Refuse paths outside the repo.

3. **Classify** the source into one or more wiki page types:
   - HTML wireframe → `surface` page
   - Decision note → `decision` page
   - Research doc / interview → typically `concept` pages (split if it covers multiple ideas), or one `synthesis` page for a brief that draws a conclusion
   - A new tier / product / canonical value → `entity` page
   - A user journey description → `flow` page
   - Don't force one source into one page — a meeting note can produce multiple pages.
   - Page types are the six in the schema plus any listed under `wiki.types` in the repo's or the estate's `.claude/zeno.yaml`, each with its folder and its required `sections` (use exactly those `## ` headings, in that order; its ID is `<TYPE>.<SLUG>`). Use an added type only when the source fits it.

4. **For each page you will create:**
   - Pick the ID per the wiki schema § "ID conventions". IDs are uppercase, dot-separated, never change.
   - Pick the filename: the slug portion of the ID, lowercase, kebab-case, `.md` extension.
   - Check whether the page already exists. If yes, **update** rather than overwrite: preserve `id`, `supersedes`, `superseded-by`; refresh `last-verified` to today.
   - Use the required sections for that page type — verbatim from the wiki schema. Missing a required section is a lint failure.
   - Fill `Related` with at least two `[[wikilinks]]`. A link to a page that doesn't exist yet is OK — `/wiki-lint` will flag it as a TODO.
   - List the source path under `Sources`, so a future `/wiki-lint` can tell which raw files nothing has read.

5. **Update `.context/wiki/index.md`:** add the new page under the right type heading, in alphabetical order by slug. Don't reformat existing entries.

6. **Leave the source where it is.** `.context/raw/` is immutable: a source is "processed" when a wiki page lists it under `Sources`, not when it moves.

7. **Report**: list each page created or updated with its ID and path. Flag any `[[wikilinks]]` to non-existent pages as "TODO targets".

## Rules

- Never edit anything under `.context/raw/` or `.context/designs/`.
- Never delete or rename an existing wiki page from this skill — use a `decision` page to log a rename, then run again.
- Never invent canonical values. If the source has a price/string/enum, copy it verbatim; if it's ambiguous, ask the user before writing.
- Follow the copy rules from the root `CLAUDE.md` for any user-facing strings you transcribe.
- Today's date is in the session context — use it for `last-verified`.
