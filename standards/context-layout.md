# The `.context/` layout

Every repo keeps its non-code product material in `.context/`, in the same
folders below. Each has one job, and none is a bucket meaning "everything else". A team
can replace this file with its own `context-layout.md` in a configured standards
folder.

```
<repo>/.context/
├── README.md        what this is, and where to start
├── tasks.md         the ordered queue. The top item is the next action.
├── context.yaml     the repo's canon config.
├── raw/             sources you didn't write. Immutable.
├── wiki/            everything you concluded. Schema: wiki-schema.md
├── problems/        what needs solving.
├── ideas/           ways to solve it.
├── experiments/     proofs and tests of an idea.
├── plans/           how it will be solved.
├── features/        what will be built.
├── bugs/            what will be fixed.
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

1. **One job per folder.** There is no `documents/`, `research/`,
   `decisions/` or `email-templates/` folder: a research brief
   is a wiki synthesis page, why a part was chosen is a wiki concept, an ADR is
   `wiki/decisions/`, a transactional email is HTML in `designs/`.
   A product that truly needs another folder adds it in `.context/context.yaml`,
   with the reason: `context: { folders: [{ folder: research, reason: … }] }`.
   The other built-in folders cannot be redefined. Record folders are changed
   under `records:` (see "The other records").
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
| uses the `docs` or `knowledge` module | + `raw/` · `wiki/`; each record folder appears with its first record |
| draws its UI | + `designs/` (required for a mobile or web repo: designs come first) |
| has a store presence | + `listing/` |
| is live to users | + `marketing/` · `metrics/` · `support/` · `legal/` |
| once something runs | + `ops/` |

## Naming and frontmatter

- Dated sources (`raw/`) → ISO date: `YYYY-MM-DD-slug.md`. Month-grain data
  keeps `YYYY-MM.csv`.
- Records (problems, ideas, experiments, plans, features, bugs) → zero-padded
  number: `NNNN-slug.md`, with the same number in the ID.
- Everything else is named by topic and edited in place.
- Frontmatter: `last-verified`, kebab-case keys. See the wiki schema.

## Where each kind of document lives

Work goes one way: a Problem, then Ideas with their discoveries and findings,
then a Plan, then Features and Bugs. Teams use other names for these documents.
Each name maps to one home; there is no separate folder per name.

| Document | Home |
|---|---|
| ADR | `wiki/decisions/<topic>.md`, overwritten when the choice changes |
| Problem, incident report from a customer, alert | `problems/`, `PROB-NNNN` |
| Input (one event from a trigger) | `sources:` on its Problem: `source`, `id`, `link`, `count`, `first`, `last`. The event stays in its own tool; its text can hold personal data and is never kept |
| Idea | `ideas/`, `IDEA-NNNN` |
| Discovery | `wiki/synthesis/`, naming its `ideas:` |
| POC, or a test that never ships | `experiments/`, `EXP-NNNN`; the result is a decision page |
| A plan or feature that goes live as a test | its own page, with `experiment: true` |
| Plan | `plans/`, `PLAN-NNNN` |
| RFC | `plans/`; once accepted, the choice goes in `wiki/decisions/` |
| PRD | `features/`, `type: feature` |
| Initiative | `plans/`, with features and bugs naming it |
| Finding | the dated data in `raw/`; what it means in `wiki/synthesis/` or a concept, naming its `ideas:` |
| Verdict | `## Verdict` on the record it judged, written by `canon verdict`. A request with no record becomes an Idea |
| Gate approval | `approvals:` on the record, written by `canon approve`; code review stays on the pull request |
| Agent run (stage, time, cost, result) | `~/.canon/runs.jsonl` on the machine. The record keeps `cost:` |
| Integration | a `SOURCE.<NAME>` page in `wiki/entities/`, and `connectors:` in `context.yaml`. Keys stay in `.env` |
| Know-how | `wiki/concepts/`; `ops/` when it is a runbook |
| Architecture and cost | `architecture/architecture.json`, the only source: `canon ui` draws it, agents read it, `canon check` verifies it. Format and rules: `architecture-page` |
| Bug | `bugs/`, `BUG-NNNN`; a wiki concept too when it teaches a rule |
| Data source | `wiki/entities/` — see the wiki schema, "Data sources" |
| Setup notes (account IDs, console links, where credentials live) | `ops/setup.md` |
| What is live right now, per surface | `ops/release.yml` |
| Runbook | `ops/runbooks/<slug>.md` |
| Incident review | `ops/incidents/YYYY-MM-DD-<slug>.md` |
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
type: feature             # feature | chore | platform
status: building          # planned | building | shipped | shelved | superseded
last-verified: 2026-04-02
release: 3.4.0            # ties to CHANGELOG.md and the release notes
superseded-by: null
surfaces: ["[[settings-screen]]"]
plan: PLAN-0007           # optional
outcome: retained         # once it has run: retained | discarded | retried
---
## Summary · ## Motivation · ## Acceptance scenarios (Given/When/Then)
## Out of scope · ## Open questions
## Store copy
> One or two sentences users will read in the release notes.
```

The wiki describes what *is*; `features/` describes what is *next*. A shipped
feature goes `status: shipped` and is never deleted, so the reasoning survives.

## The other records

Every record has `id`, `status` and `last-verified`. `canon check` verifies the
fields and sections below, and that each link names a record that exists.

| Record | Status | Other fields | Sections |
|---|---|---|---|
| `problems/` | open · solving · solved · dismissed | `source` (who or what raised it), `priority` (p0–p3) | Summary · Impact · Expected |
| `ideas/` | draft · accepted · shipped · dropped | `problems: [PROB-0001]`, `owner`, `due` | Summary |
| `experiments/` | planned · running · done · dropped | `kind` (poc · experiment), `ideas: [IDEA-0001]` | Summary; Result once done. An experiment also has Hypothesis and Metric (a name from `metrics/definitions.yml`) |
| `plans/` | draft · approved · building · done · dropped | `problem: PROB-0001`, `ideas: [IDEA-0001]` | Approach · Steps |
| `bugs/` | open · fixing · fixed · wontfix | `severity` (low · medium · high · critical), `plan: PLAN-0001` | Summary · Expected · Actual |

These are the defaults. A repo changes them in `context.yaml`: `canon check`
follows what it says, and a link can name any kind the repo has.

```yaml
records:
  - { folder: campaigns, prefix: CAMP, statuses: [draft, live, ended], fields: { channel: [email, ads] }, sections: [Goal] }  # add
  - { folder: bugs, statuses: [new, closed] }   # change: only what is named
  - { folder: ideas, remove: true }             # remove
```

The runner keeps its place on the record: `pipeline`, `stage`, `completed`,
`skipped` (with the reason) and `cost`.

### Experiments that go live

Any record can run as a test and be thrown away on its results. Add
`experiment: true`, with `## Hypothesis` and `## Metric`. When the results are
in, set `outcome` and write `## Result`. A discarded page is never deleted, so
nobody proposes the same thing again without seeing what happened.

## Meanings, priority, approvals and ownership

`canon records` prints a repo's vocabulary in words, and agents are given the same
text. Everything below is a default a repo changes in `context.yaml`.

```yaml
owner: payments                 # who owns work unless a record says otherwise
priorities:                     # replaces the list; most urgent first
  urgent: Customers are blocked.
  later: Do it when there is room.
records:
  - { folder: bugs, statuses: [new, closed], closed: [closed], meanings: { status: { new: Fresh from a customer. } } }
pipelines:
  default:
    - { id: plan, by: agent, gate: true, approvers: [ana, ben], required: 2 }
```

- **Meanings:** `meanings:` under a record kind explains the values of any field.
  `closed:` names the statuses that end the work.
- **Priority:** `priority:` on any record. `canon queue` lists open work by it,
  most urgent first. The `records` check fails a value not in the list.
- **Approvals:** `canon approve` adds a person to `approvals:`; `canon reject` sends
  the stage back with a reason, clears its approvals, and the next run is told why.
  `approvers:` limits who counts and `required:` how many. People are matched by
  their git user name, so this is a record, not proof of identity.
- **Ownership:** `owner:` on a record is a person or team, defaulting to the
  config's `owner`. To require one, add `owner` under a kind's `fields:`.
- **Versions:** git versions all of it. `canon:` in `context.yaml` pins the canon
  version. A run writes `rules:` on the record, the commit of `context.yaml` it
  started under.

## Templates

`canon new <kind> "<title>"` starts a page: `problem`, `idea`, `experiment`,
`plan`, `feature`, `bug`, `discovery`, `finding`, `decision`, or a kind the repo
added. A repo's own kind gets its template from its fields and sections, or from
`template:` under `records:`, which can also replace a default's.

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
