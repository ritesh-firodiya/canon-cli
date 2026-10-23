---
name: wiki-lint
description: Audit .context/wiki/ for drift — broken [[links]], orphan pages, contradictions between entities, stale last-verified dates, unprocessed raw files. Optionally auto-fix safe issues and regenerate .context/wiki/index.md. Usage `/wiki-lint` (audit) or `/wiki-lint --fix` (audit + auto-fix).
---

You are linting the wiki at `.context/wiki/` against the wiki schema (the `wiki-schema.md` that `zeno standards` lists — a team's own replaces zeno's; without the CLI, `../../standards/wiki-schema.md` relative to this skill).

Mode: `$ARGUMENTS` (empty = audit only; `--fix` = audit + auto-fix safe issues).

## Steps

1. **Read the wiki schema** to refresh schema, ID conventions, required sections, and the lint-rules table.

2. **Run `zeno check` first** if the CLI is installed. It checks frontmatter,
   duplicate IDs, staleness and prices held by no entity in under a second,
   plus any checker the repo declares. Start from its output rather than
   re-deriving it.

3. **Enumerate pages.** List every `.md` file under `.context/wiki/` (excluding `index.md` and `CLAUDE.md`). For each, parse the frontmatter.

4. **Build the graph:**
   - Map `id → file path`.
   - For each page, extract all `[[wikilink]]` tokens from the body.
   - Build inbound and outbound link sets per page.

5. **Run the checks below.** Group findings into **Blockers** and **Warnings**.

### Blockers (must be fixed)

| Check | Rule |
|---|---|
| Missing required section | Per the wiki schema § "Page body — required sections" |
| Broken `[[wikilink]]` | Target page does not exist |
| Duplicate `id` | Two pages claim the same ID |
| Contradictory canonical value | Two `entity` pages list the same key with different values |
| `status: superseded` with no `superseded-by` | Set or remove the status |
| Filename ↔ id slug mismatch | The filename must match the slug portion of the ID |
| `type` does not match folder | `type: concept` must live in `concepts/`, etc. A type added under `wiki.types` in `.claude/zeno.yaml` lives in its configured folder. |

### Warnings

| Check | Rule |
|---|---|
| Orphan page | Zero inbound `[[wikilinks]]`. Exception: `decision` and `synthesis` pages are commonly orphan-source. |
| Stale `last-verified` | > 90 days from today. |
| Unprocessed raw file | A file under `.context/raw/` that no wiki page references in its `Sources`. |
| Stale synthesis | A `synthesis` page where any `Built from` page was modified after the synthesis's `Last refresh`. |
| Page missing two outbound links | Body has fewer than two `[[wikilinks]]`. |
| User-facing string violates copy rules | Check quoted copy against the rules in the root `CLAUDE.md`. Best-effort. |

6. **Auto-fix (only if `--fix` is in `$ARGUMENTS`):**
   - Regenerate `.context/wiki/index.md` from scratch: enumerate pages by type, sort alphabetically by slug, keep the structure the file already has.
   - Fix `last-verified` to today's date on any page whose body was edited in the working tree.
   - Fix filename ↔ id slug mismatches (rename the file; do NOT change the ID).
   - **Never** auto-fix: contradictory canonical values, missing required sections, broken `[[wikilinks]]`. These need a human decision.

7. **Report.** Print:
   - Counts: pages, blockers, warnings, auto-fixes applied.
   - Per-finding lines: `[BLOCKER|WARN] <path>:<rule> — <detail>`.
   - For each blocker, one suggested fix.
   - For broken `[[wikilinks]]`, list candidate existing pages by name similarity.

## Rules

- **Never edit pages other than auto-fixes above.** Lint reports; the user (or `/ingest`) fixes.
- **Never delete pages.** Superseded pages stay on disk with `status: superseded` and `superseded-by: <new-id>`.
- **Never modify `.context/raw/`** except to warn about unprocessed files.
- If a blocker resists auto-fix, exit non-zero (in CI mode) but always print the full report first.
- Today's date is in the session context — use it for staleness math (>90 days).
