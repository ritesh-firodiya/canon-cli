---
name: wiki-lint
description: Audit .context/wiki/ for drift — broken [[links]], orphan pages, contradictions between entities, stale last-verified dates, unprocessed raw files. Optionally auto-fix safe issues and regenerate .context/wiki/index.md. Usage `/wiki-lint` (audit) or `/wiki-lint --fix` (audit + auto-fix).
---

You are linting the wiki at `.context/wiki/` against the wiki schema (the `wiki-schema.md` that `zeno standards` lists — a team's own replaces zeno's; without the CLI, `../../standards/wiki-schema.md` relative to this skill).

Mode: `$ARGUMENTS` (empty = audit only; `--fix` = audit + auto-fix safe issues).

## Steps

1. **Read the wiki schema** to refresh the folders, the one test and the caps.

2. **Run `zeno check` first** if the CLI is installed. It checks frontmatter,
   placeholders, caps, dated decision names, duplicate IDs, staleness and
   prices held by no entity in under a second,
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
| Broken `[[wikilink]]` | Target page does not exist |
| Duplicate `id` | Two pages claim the same ID |
| Contradictory canonical value | Two `entity` pages list the same key with different values |
| Placeholder text | `TBD`, `none yet`: write the fact or delete the section |
| `type` does not match folder | If a page sets `type`, it lives in that type's folder |

### Warnings

| Check | Rule |
|---|---|
| Over a cap | Page 60 lines, decision 30, README 30, tasks 100 |
| Restates code, a design or git | Delete the lines; link the source instead |
| Two pages on one topic | Merge into one, edited in place |
| Stale `last-verified` | > 90 days from today. |
| Unprocessed raw file | A file under `.context/raw/` that no wiki page references in its `Sources`. |
| User-facing string violates copy rules | Check quoted copy against the rules in the root `CLAUDE.md`. Best-effort. |

6. **Auto-fix (only if `--fix` is in `$ARGUMENTS`):**
   - Regenerate `.context/wiki/index.md` from scratch: enumerate pages by type, sort alphabetically by slug, keep the structure the file already has.
   - Fix `last-verified` to today's date on any page whose body was edited in the working tree.
   - **Never** auto-fix: contradictory canonical values, broken `[[wikilinks]]`, merges or cuts. These need a human decision.

7. **Report.** Print:
   - Counts: pages, blockers, warnings, auto-fixes applied.
   - Per-finding lines: `[BLOCKER|WARN] <path>:<rule> — <detail>`.
   - For each blocker, one suggested fix.
   - For broken `[[wikilinks]]`, list candidate existing pages by name similarity.

## Rules

- **Never edit pages other than auto-fixes above.** Lint reports; the user (or `/ingest`) fixes.
- **Never delete pages from this skill.** Propose the cut; the user approves it. Git keeps what is deleted.
- **Never modify `.context/raw/`** except to warn about unprocessed files.
- If a blocker resists auto-fix, exit non-zero (in CI mode) but always print the full report first.
- Today's date is in the session context — use it for staleness math (>90 days).
