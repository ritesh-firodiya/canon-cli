# The `.context/` layout

Every repo keeps its non-code product material in `.context/`, in the same ten
folders. Each has one job, and none is a bucket meaning "everything else". A team
can replace this file with its own `context-layout.md` in a configured standards
folder.

```
<repo>/.context/
├── README.md        what this is, and where to start
├── tasks.md         the ordered queue. The top item is the next action.
├── context.yaml     the repo's canon config.
├── raw/             sources you didn't write. Immutable.
├── wiki/            everything you concluded. Schema: wiki-schema.md
├── features/        what's next.
├── designs/         what it looks like.
├── architecture/    how it is built and what it costs: architecture.json.
├── listing/         what the stores show.
├── marketing/       how it's sold.
├── metrics/         the numbers.
├── support/         what you tell users.
├── legal/           what you promise.
└── ops/             how you run it.
```

## Rules

1. **Eleven folders, one job each.** There is no `documents/`, `research/`,
   `decisions/` or `email-templates/` folder: a research brief
   is a wiki synthesis page, why a part was chosen is a wiki concept, an ADR is
   `wiki/decisions/`, a transactional email is HTML in `designs/`.
   A product that truly needs another folder adds it in `.context/context.yaml`,
   with the reason: `context: { folders: [{ folder: research, reason: … }] }`.
   The ten cannot be removed.
2. **`README.md`, `tasks.md`, `context.yaml` and the uncommitted `context.local.yaml` are the only files at `.context/` root.**
   A repo names only what it uses. Its README, its `context.yaml` and its docs never
   list a folder, file or tool it does without; absence is shown by absence.
3. **Nothing is created empty.** A folder appears with its first file — git does
   not track empty folders, so a placeholder disappears on clone. `raw/` is the
   one exception and carries a `.gitkeep`.
4. **One home per artifact; everything else is an export.** Source art lives in
   `designs/`; store images and press kits are generated from it.
5. **Authored vs generated is visible.** A generated file is committed but never
   hand-edited. Its source is a hand-written file such as `marketing/context.md`,
   `metrics/definitions.yml` or `metrics/events.yml`.

## What a repo is expected to have

| Stage | Expected |
|---|---|
| any repo | `README.md` · `tasks.md` · `context.yaml` |
| uses the `docs` or `knowledge` module | + `raw/` · `wiki/` · `features/` |
| draws its UI | + `designs/` (required for a mobile or web repo: designs come first) |
| has a store presence | + `listing/` |
| is live to users | + `marketing/` · `metrics/` · `support/` · `legal/` |
| once something runs | + `ops/` |

## Naming and frontmatter

- Dated sources (`raw/`) → ISO date: `YYYY-MM-DD-slug.md`. Month-grain data
  keeps `YYYY-MM.csv`.
- Features → zero-padded number: `NNNN-slug.md`.
- Everything else is named by topic and edited in place.
- Frontmatter: `last-verified`, kebab-case keys. See the wiki schema.

## Where each kind of document lives

Teams name documents many ways. Each name maps to one home; there is no
separate folder per name.

| Document | Home |
|---|---|
| ADR | `wiki/decisions/<topic>.md`, overwritten when the choice changes |
| RFC | `features/`; once accepted, the choice goes in `wiki/decisions/` |
| PRD | `features/`, `type: feature` |
| Experiment | `features/`, `type: experiment`; the result is a decision page |
| Initiative | `wiki/synthesis/`, linking its features and decisions |
| Finding | the dated data in `raw/`; what it means in `wiki/synthesis/` or a concept |
| Know-how | `wiki/concepts/`; `ops/` when it is a runbook |
| Architecture and cost | `architecture/architecture.json`, the only source: `canon ui` draws it, agents read it, `canon check` verifies it. Format and rules: `architecture-page` |
| Bug | the issue tracker; a wiki concept only when it teaches a rule |
| Data source | `wiki/entities/` — see the wiki schema, "Data sources" |
| Setup notes (account IDs, console links, where credentials live) | `ops/setup.md` |
| What is live right now, per surface | `ops/release.yml` |
| Runbook | `ops/runbooks/<slug>.md` |
| Incident | `ops/incidents/YYYY-MM-DD-<slug>.md` |
| Dated engineering narrative | `CHANGELOG.md` at the repo root |

If a document fits none of these for a real product, add a wiki type or a
folder in `.context/context.yaml` with its reason — not a new convention by hand.

## Inside the folders

A folder holds only what it uses; these are the usual names.

```
marketing/   context.md (identity, goals, markets) · brand/ (WORDS only — art is in designs/brand/)
             posts/ · video/ · launch/ · press/ (press/media/ is an export of designs/brand/)
metrics/     definitions.yml (the KPI dictionary) · events.yml (what each event means)
             history/YYYY-MM.csv (metric,period,value)
support/     SUPPORT.md · faq/ · replies/ · reviews/
legal/       privacy policy · terms · data deletion
ops/         release.yml · setup.md · runbooks/ · incidents/
```

## Repo root

These stay at the root, because a host renders them or a tool reads them by
exact path: `README.md` · `LICENSE` · `CHANGELOG.md` · `CONTRIBUTING.md` ·
`SECURITY.md` · `CLAUDE.md` · `AGENTS.md` · `.github/`.

`TODO.md`, `STATUS.md` and `SETUP.md` do not. `SETUP.md` becomes `ops/setup.md`.
The other two are not single documents, so split them: the backlog goes to
`tasks.md`, what is live to `ops/release.yml`, the dated narrative to
`CHANGELOG.md`, canonical values to `wiki/entities/`, a how-to to `ops/runbooks/`.

## `features/` — what is next

One page per feature, `NNNN-<slug>.md`:

```markdown
---
id: FEAT-0031
type: feature             # feature | experiment | chore | platform
status: building          # planned | building | shipped | shelved | superseded
last-verified: 2026-04-02
release: 3.4.0            # ties to CHANGELOG.md and the release notes
superseded-by: null
surfaces: ["[[settings-screen]]"]
---
## Summary · ## Motivation · ## Acceptance scenarios (Given/When/Then)
## Out of scope · ## Open questions
## Store copy
> One or two sentences users will read in the release notes.
```

An experiment adds `## Hypothesis`, `## Metric` (a name from
`metrics/definitions.yml`) and `## Result` once it has run.

The wiki describes what *is*; `features/` describes what is *next*. A shipped
feature goes `status: shipped` and is never deleted, so the reasoning survives.

## `tasks.md` — open work only

```markdown
# Tasks

## Now                       <!-- position is the dependency; do in order -->
1. [ ] T001 Add a screenshot mode  `feat:0002`  ~1d
2. [ ] T002 Write the capture flows  needs:T001  ~3h

## Parallel                  <!-- independent, safe to batch -->
- [ ] T004 Move the SKU IDs into the wiki  ~1h

## Blocked
- [ ] T005 Submit the iOS build
      blocked-by: store account access  since:2026-09-16
      unblock: ask for the role  next-check:2026-10-06

## Waiting                   <!-- deferred by time, not by a task -->
- [ ] T006 Second-language listing  wait:2026-11-01
```

Delete a task when it is done — the commit records it. No `## Done`, no session
notes. Cap: 100 lines. A blocker with no unblocking action and no check date is a
silent leak. A task that needs more than a line and a continuation is a
`features/` page.
