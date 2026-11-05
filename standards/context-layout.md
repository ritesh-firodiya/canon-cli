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
├── ops/             how you run it.
└── templates/       optional: the repo's own templates for canon new.
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
| uses the `docs` or `knowledge` module | + `raw/` · `wiki/` · `features/`; other record folders appear with their first record |
| draws its UI | + `designs/` (required for a mobile or web repo: designs come first) |
| has a store presence | + `listing/` |
| is live to users | + `marketing/` · `metrics/` · `support/` · `legal/` |
| once something runs | + `ops/` |

## Naming and frontmatter

- Dated sources (`raw/`) → ISO date: `YYYY-MM-DD-slug.md`. Month-grain data
  keeps `YYYY-MM.csv`.
- Records → zero-padded number: `NNNN-slug.md`, with the same number in the ID.
  Experiments → their unique name: `<name>.md`.
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
| POC, experiment | `experiments/<name>.md`; records made for it name it with `experiment:` |
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
surfaces: [settings-screen]
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

## Records

Only `id` is required (`name` on a named kind). A value that is present must fit
the rules below. A repo requires what it wants. `canon records` prints a repo's
vocabulary in words, and agents are given the same text.

| Record | Status | Usual sections |
|---|---|---|
| `problems/` | open · solving · solved · dismissed | Summary · Impact · Expected |
| `ideas/` | draft · accepted · shipped · dropped | Summary |
| `experiments/` | planned · running · done · dropped | Summary · Hypothesis · Metric · Result |
| `plans/` | draft · approved · building · done · dropped | Approach · Steps |
| `features/` | planned · building · shipped · shelved · superseded | Summary · Motivation · Acceptance scenarios |
| `bugs/` | open · fixing · fixed · wontfix | Summary · Expected · Actual |

A record with no status counts as open. Canon writes `pipeline`, `stage`,
`completed`, `skipped`, `verified`, `approvals`, `rejections`, `sources`, `cost`
and `rules`; `canon set` refuses them.

### Changing them

```yaml
owner: payments                 # who owns work unless a record says otherwise
priorities:                     # replaces the list; most urgent first
  urgent: Customers are blocked.
  later: Do it when there is room.
records:
  - folder: plans
    fields:
      timeline: date-range      # text, date, date-range, number or link
      risk: [low, high]         # allowed values
      owner: remove             # a page may not have it
    required: [timeline, "## Approach"]
    statuses: [new, closed]
    closed: [closed]            # the statuses that end the work
    meanings: { status: { new: Fresh from a customer. } }
  - { folder: campaigns, prefix: CAMP, statuses: [draft, live] }   # a kind of your own
  - { folder: ideas, remove: true }
```

`canon set PLAN-0001 status=approved` changes a field, checked against these rules.
`canon done PLAN-0001` sets the kind's first closing status.

### The flow

```
intake ─┬─ problem ──┐
        ├─ idea ─────┼─ prioritize → collect → research → design → plan → feature → code → review → release → outcome
        └─ discovery ┘                                                                                          │
   ↑                                                                                                            │
   └──────────────────────────── a discarded or retried outcome opens a new problem ───────────────────────────┘
```

| Stage | What it means |
|---|---|
| `intake` | Read the signals (a user, an email, an error, a bug report, a metric) and check they are true. |
| `problem` | What is wrong, and what should be true instead. `problems/`. |
| `idea` | A proposed change, before research. `ideas/`. |
| `discovery` | Something learned: data, user behavior, a market fact. `wiki/synthesis/`. |
| `prioritize` | `priority:` set from the facts behind it: how many it hurts, how often, what it costs. |
| `collect` | Data from the tools, as dated facts in `raw/` (`canon new fact`). No data is written as no data. |
| `research` | What is already known, in the repo and outside it: who else has the problem, how they solved it, and how well it worked. Questions fit the case; vendor claims are marked as claims. `wiki/synthesis/`. |
| `design` | The screens that change. Optional, gated. Before the plan, so the plan is weighed with them. |
| `plan` | Each way to solve it written as an idea, one chosen, and why the others lost. Gated. |
| `feature` | The plan split into features, bugs and chores. |
| `code`, `review`, `release` | Built, checked (gated), shipped. |
| `outcome` | Whether it worked: `outcome: retained`, `discarded` or `retried`, and `## Result`. A discarded or retried outcome opens one new problem, `source:` the old record, starting at the first stage. |

A signal is not a stage: it is where work comes from, kept as `source:` and `sources:`
on the record. Every stage checks that what it was given is true before it uses it.

**Forks.** `after: [stage, ...]` on a stage names the stages it may follow. With no
`after:`, a stage follows the one above it, so a plain list is a straight line. In the
default, problem, idea and discovery each follow intake or one another, in any order;
each is optional with a `when:`, so a work item takes any of them, or none. `canon
pipeline` shows the forks. `after:` must name stages in the same pipeline, never the
stage itself, and every stage must be reachable from the first.

**Where work starts.** A record starts at its `started-at:` stage, else the stage named
for its kind (a problem at `problem`, an idea at `idea`), else the first stage. The
stage named for its kind is done by the page existing. A problem opened by a trigger
starts at the first stage, so its signal is checked. A run and `canon check` cover only
what lies after the start.

A repo re-orders, adds, removes or renames stages under `pipelines:`, and adds named
pipelines. A stage naming a default id inherits what it does not set, except `after:`:
where a stage sits is the repo's own. An optional stage with `when:` is decided by the
AI; with no `when:` it is skipped unless asked for: `canon run <id> --with <stage>` or
`--skip <stage>`.

### Experiments

An experiment has a unique name and can start at any stage, inside a fork too:
`canon new experiment checkout-retry --from design`. It sets `started-at:`, so its run
and checks begin there. `--to <stage>` sets `stops-at:`, a stage reachable from the
start. A POC is `--from code --to code`. Records made for it name it:
`experiment: checkout-retry`. When the results are in, set `outcome: retained`,
`discarded` or `retried` and write `## Result`. A discarded page is never deleted, so
nobody proposes the same thing again without seeing what happened.

### Checking before a change

`verify: [sentry, "https://app.example.com"]` on a stage lists connectors and live
addresses. A read-only step checks them first. Confirmed, the stage runs. Wrong, the
run stops and says what it found. If a source cannot be checked, the run stops for a
person: `canon run <id> --unverified "<reason>"`. A source being down never counts as
confirmed. The result goes under `## Checked` on the record.

### Approvals and ownership

`canon approve` adds a person to `approvals:`; `canon reject` sends the stage back
with a reason, clears its approvals, and the next run is told why. `approvers:` limits
who counts and `required:` how many. `owner:` is a person or team, defaulting to the
config's `owner`.

### Versions

Git versions all of it. `canon:` in `context.yaml` pins the canon version. A run writes
`rules:` on the record, the commit of `context.yaml` it started under.

### What stays enforced

A repo decides its flow, and canon enforces what it decided. No config can change that
an agent run cannot approve, reject or close work past a gate; that a stage passes only
by being done or skipped with a reason; that connectors and checks only read; that no
key or event text is stored; that a run stops at its spend cap; that ids are unique and
links resolve; or that a locked value holds. `canon check --status` lists what a repo has
weakened against the defaults and its layers, and whether it has a hook and a CI job.

The force comes from the CI job and required reviews on the branch. The hook can be
skipped, local approvals are matched by git name, and `weigh` is advice.

## Templates

`canon new <kind> "<title>"` starts a page: `problem`, `idea`, `experiment`,
`plan`, `feature`, `bug`, `discovery`, `finding`, `decision`, `fact` (a dated page in `raw/`), or a kind the repo
added. canon reads `.context/templates/<folder>.md` first (`problems.md`,
`finding.md`), then its own; a repo's own kind with neither gets one from its
fields and sections.

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
