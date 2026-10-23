# The `.context/` layout

Every repo keeps its non-code product material in `.context/`, in the same ten
folders. Each has one job, and none is a bucket meaning "everything else". A team
can replace this file with its own `context-layout.md` in a configured standards
folder.

```
<repo>/.context/
├── README.md        what this is, and which folders are absent and why
├── tasks.md         the ordered queue. The top item is the next action.
├── raw/             sources you didn't write. Immutable.
├── wiki/            everything you concluded. Schema: wiki-schema.md
├── features/        what's next.
├── designs/         what it looks like.
├── listing/         what the stores show.
├── marketing/       how it's sold.
├── metrics/         the numbers.
├── support/         what you tell users.
├── legal/           what you promise.
└── ops/             how you run it.
```

## Rules

1. **Ten folders, one job each.** There is no `documents/`, `research/`,
   `architecture/` or `decisions/` folder: a research brief is a wiki synthesis
   page, an architecture note is a wiki concept, an ADR is `wiki/decisions/`.
2. **`README.md` and `tasks.md` are the only files at `.context/` root.**
   `README.md` lists every absent folder as `n/a — <why>`.
3. **Nothing is created empty.** A folder appears with its first file — git does
   not track empty folders, so a placeholder disappears on clone. `raw/` is the
   one exception and carries a `.gitkeep`.
4. **One home per artifact; everything else is an export.** Source art lives in
   `designs/`; store images and press kits are generated from it.
5. **Authored vs generated is visible.** A generated file is committed but never
   hand-edited.

## What a repo is expected to have

| Stage | Expected |
|---|---|
| any repo | `README.md` · `tasks.md` · `raw/` · `wiki/` · `features/` |
| draws its UI | + `designs/` |
| has a store presence | + `listing/` |
| is live to users | + `marketing/` · `metrics/` · `support/` · `legal/` |
| once something runs | + `ops/` |

## Naming and frontmatter

- Append-only, time-ordered files → ISO date: `YYYY-MM-DD-slug.md`.
- Files referenced by a stable ID → zero-padded number: `NNNN-slug.md`.
- Frontmatter follows the wiki schema: `id`, `type`, `status`, `last-verified`,
  `supersedes`, `superseded-by`. Kebab-case keys.

## `features/` — what is next

One page per feature, `NNNN-<slug>.md`:

```markdown
---
id: FEAT-0031
type: feature             # feature | experiment | chore | platform
status: building          # planned | building | shipped | shelved | superseded
last-verified: 2026-04-02
release: 3.4.0
---
## Summary · ## Motivation · ## Acceptance scenarios (Given/When/Then)
## Out of scope · ## Open questions
## Store copy
> One or two sentences users will read in the release notes.
```

The wiki describes what *is*; `features/` describes what is *next*. A shipped
feature goes `status: shipped` and is never deleted.

## `tasks.md` — the ordered queue

```markdown
---
updated: 2026-09-29
horizon: 2026-10-13        # this file is stale after this date
---

# Tasks

## Now                       <!-- position is the dependency; do in order -->
1. [ ] T001 Add a screenshot mode  `feat:0002`  ~1d
2. [ ] T002 Write the capture flows  needs:T001  ~3h

## Parallel                  <!-- independent, safe to batch -->
- [ ] T004 [P] Move the SKU IDs into the wiki  ~1h

## Blocked
- [ ] T005 Submit the iOS build
      blocked-by: store account access  since:2026-09-16
      unblock: ask for the role  next-check:2026-10-06

## Waiting                   <!-- deferred by time, not by a task -->
- [ ] T006 Second-language listing  wait:2026-11-01

## Done
- [x] T000 Set up .context  done:2026-09-29

## Session Notes
### 2026-09-29
- Done: T000.  Learned: …  Next: T001.
```

A blocker with no named unblocking action and no check date is a silent leak.
A task that needs more than a line and a continuation is a `features/` page.
