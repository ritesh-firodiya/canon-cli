# Context

Where a product's knowledge lives, and what every repo must have so a person or an
agent can start work on it. How each page is written is in `writing.md`. Together
they are **Plain Context**.

A team can replace this file with its own `context.md` in a configured standards
folder.

## The start minimum

A repo is onboarded when a newcomer can answer five questions from `.context/`
alone: what is it, who is it for, how do I run it, what must I never do, and what
is next.

| Page | Answers |
|---|---|
| `README.md` | Where to start: what to read, in order |
| `wiki/concepts/purpose.md` | What it is, who it is for, the problem it solves, what it is not, its status |
| `wiki/concepts/glossary.md` | The product's and the domain's words, one meaning each |
| `architecture/architecture.json` | How it is built and what it costs |
| `ops/run.md` | How to run, test and release it |
| `wiki/decisions/` | What was chosen, and what was rejected |
| `tasks.md` | What is next |

`canon check` warns when one is missing.

## Three kinds of knowledge

| Kind | What | Home |
|---|---|---|
| Product | purpose, features, decisions, ideas | `wiki/concepts/purpose.md`, `features/`, `wiki/decisions/`, `ideas/` |
| Domain | the words, the rules of the field, the exact values | `wiki/concepts/glossary.md`, `wiki/concepts/`, `wiki/entities/` |
| Technical | how it is built, run and changed | `architecture/`, `ops/`, `wiki/decisions/` |

## Folders

```
<repo>/.context/
├── README.md        where to start
├── tasks.md         the ordered queue; the top item is the next action
├── context.yaml     the repo's canon config
├── raw/             sources you did not write; never edited
├── wiki/            what you concluded (see "The wiki")
├── problems/        what needs solving
├── ideas/           ways to solve it
├── experiments/     proofs and tests of an idea
├── plans/           how it will be solved
├── features/        what will be built
├── bugs/            what will be fixed
├── designs/         what it looks like
├── architecture/    how it is built and what it costs: architecture.json
├── listing/         what the stores show
├── marketing/       how it is sold
├── metrics/         the numbers
├── support/         what you tell users
├── legal/           what you promise
├── ops/             how you run it
└── templates/       optional: the repo's own templates for `canon new`
```

### Rules

1. **One job per folder.** No `documents/`, `research/` or `decisions/` at the top.
   A product that truly needs another folder adds it in `context.yaml` with the
   reason: `context: { folders: [{ folder: research, reason: … }] }`.
2. **Only `README.md`, `tasks.md`, `context.yaml` and the uncommitted
   `context.local.yaml` sit at the root.**
3. **Nothing is created empty.** A folder appears with its first file. `raw/` is
   the one exception and keeps a `.gitkeep`.
4. **One home per artifact.** Source art lives in `designs/`; store images and press
   kits are exports of it.
5. **Generated files are never hand-edited.** Change the source (`marketing/context.md`,
   `metrics/definitions.yml`) and generate again.
6. **Name only what you use.** A README or config never lists a folder or tool the
   repo does without.

### What a repo is expected to have

| When | Add |
|---|---|
| always | `README.md` · `tasks.md` · `context.yaml` |
| the `docs` or `knowledge` module is on | `raw/` · `wiki/` · `features/` |
| it draws a UI | `designs/` (designs come before code) |
| it is in a store | `listing/` |
| it is live to users | `marketing/` · `metrics/` · `support/` · `legal/` |
| something runs | `ops/` |

Inside them: `metrics/` holds `definitions.yml`, `events.yml` and
`history/YYYY-MM.csv`; `ops/` holds `run.md`, `setup.md`, `release.yml`,
`runbooks/` and `incidents/`; `marketing/` holds `context.md`, `brand/` (words only),
`posts/` and `launch/`; `support/` holds `faq/` and `replies/`.

## The wiki

`wiki/` holds what an agent would get wrong without being told.

| Folder | Holds | Example |
|---|---|---|
| `concepts/` | a rule, an invariant, a user journey; `purpose` and `glossary` | `money-in-minor-units` |
| `entities/` | exact values (prices, SKUs, limits, data sources), one home each | `plan-pro` |
| `decisions/` | one file per topic: the current choice | `pricing` |
| `surfaces/` | what a screen's design cannot show (only screens that have some) | `paywall` |
| `synthesis/` | research and analysis | `tax-table-ay-2026-27` |

A product may add a wiki folder in `context.yaml` under `wiki.types`, with a reason.
Not for the wiki: code docs (beside the code), tasks, plans, chat logs, changelogs.

**Data sources.** Each tool that holds product data is one entity page,
`id: SOURCE.<NAME>`, with a `## How to query` section and an access line: `mcp:`,
`skill:`, `cli:` (also in `doctor.tools`) or `manual:`. Queries only read, one or two
per claim, with a row limit. Save counts and rates to
`raw/YYYY-MM-DD-<source>-<slug>.md`, never rows that name a person, never a key.

## Where each document lives

Teams use many names for the same document. Each maps to one home.

| Document | Home |
|---|---|
| ADR, decision | `wiki/decisions/<topic>.md`, overwritten when the choice changes |
| Problem, customer incident, alert | `problems/`, `PROB-NNNN` |
| Input from a trigger | `sources:` on its problem; the event text stays in its tool |
| Idea | `ideas/`, `IDEA-NNNN` |
| Discovery, research brief | `wiki/synthesis/`, naming its `ideas:` |
| POC, experiment | `experiments/<name>.md` |
| Plan, RFC, initiative | `plans/`, `PLAN-NNNN`; an accepted choice goes to `wiki/decisions/` |
| PRD, feature | `features/`, `FEAT-NNNN` |
| Bug | `bugs/`, `BUG-NNNN`; a concept too when it teaches a rule |
| Finding | dated data in `raw/`; what it means in `wiki/synthesis/` |
| Verdict | `## Verdict` on the record it judged (`canon verdict`) |
| Gate approval | `approvals:` on the record (`canon approve`) |
| Agent run | `~/.canon/runs.jsonl` on the machine; the record keeps `cost:` |
| Integration | a `SOURCE.<NAME>` entity, and `connectors:` in `context.yaml` |
| Architecture and cost | `architecture/architecture.json` (format: `architecture-page`) |
| How to run, test, release | `ops/run.md` |
| Setup notes (account IDs, consoles) | `ops/setup.md` |
| What is live now | `ops/release.yml` |
| Runbook | `ops/runbooks/<slug>.md` |
| Incident review | `ops/incidents/YYYY-MM-DD-<slug>.md` |
| Dated history | `CHANGELOG.md` at the repo root |

A document that fits none of these gets a wiki type or a folder in `context.yaml`
with its reason, not a new habit by hand.

## Repo root

Only these stay at the root, because a host shows them or a tool reads them there:
`README.md` · `LICENSE` · `CHANGELOG.md` · `CONTRIBUTING.md` · `SECURITY.md` ·
`CLAUDE.md` · `AGENTS.md` · `.github/`. `SETUP.md` becomes `ops/setup.md`. `TODO.md`
and `STATUS.md` are split: open work to `tasks.md`, what is live to
`ops/release.yml`, history to `CHANGELOG.md`.

## Names

- `raw/` files: `YYYY-MM-DD-slug.md`; month data: `YYYY-MM.csv`.
- Records: `NNNN-slug.md`, numbered from `0001` per kind, the same number in the ID.
  Experiments: `<name>.md`.
- Everything else is named by topic and edited in place.

## Records

Each kind of work has a folder, an ID and its own statuses. `canon records` prints a
repo's kinds, fields, statuses and what each status means; that output is the one
home for them. Only `id` is required (`name` for an experiment). A record with no
status counts as open. canon writes `pipeline`, `stage`, `completed`, `skipped`,
`verified`, `approvals`, `rejections`, `sources`, `cost` and `rules`; `canon set`
refuses them.

A feature page:

```markdown
---
id: FEAT-0001
status: building        # planned | building | shipped | shelved | superseded
last-verified: 2026-11-06
release: 3.4.0
plan: PLAN-0001         # optional
outcome: retained       # once it has run: retained | discarded | retried
---
# Settings screen
## Summary · ## Motivation · ## Acceptance scenarios (Given/When/Then) · ## Out of scope
## Store copy
> One or two sentences users read in the release notes.
```

A shipped feature stays, with `status: shipped`, so its reasons survive. The wiki
says what *is*; `features/` says what is *next*.

A repo changes its records in `context.yaml`:

```yaml
owner: payments
priorities: { urgent: Customers are blocked., later: When there is room. }
records:
  - folder: plans
    fields: { timeline: date-range, risk: [low, high], owner: remove }
    required: [timeline, "## Approach"]
    statuses: [new, closed]
    closed: [closed]
  - { folder: campaigns, prefix: CAMP, statuses: [draft, live] }
  - { folder: ideas, remove: true }
```

`canon set PLAN-0001 status=approved` changes a field; `canon done PLAN-0001` closes it.
`canon new <kind> "<title>"` starts a page from `.context/templates/<folder>.md`, else
canon's own template.

## The flow

```
intake ─┬─ problem ──┐
        ├─ idea ─────┼─ prioritize → collect → research → design → plan → feature → code → review → release → outcome
        └─ discovery ┘
```

| Stage | Means |
|---|---|
| `intake` | Read the signal (a user, an error, a metric) and check it is true |
| `problem` | What is wrong, and what should be true instead |
| `idea` | A proposed change, before research |
| `discovery` | Something learned: data, behaviour, a market fact |
| `prioritize` | Set `priority:` from facts: how many it hurts, how often, what it costs |
| `collect` | Data from the tools, as dated facts in `raw/`; no data is written as no data |
| `research` | What is already known, here and outside; vendor claims marked as claims |
| `design` | The screens that change; before the plan, so the plan is weighed with them |
| `plan` | Each option written as an idea, one chosen, why the others lost (gated) |
| `feature` | The plan split into features, bugs and chores |
| `code` · `review` · `release` | Built, checked (gated), shipped |
| `outcome` | Did it work: `retained`, `discarded` or `retried`; the last two open a new problem |

- **Forks.** `after: [ids]` names the stages a stage may follow. With no `after:` it
  follows the stage above, so a plain list is a line.
- **Start.** A record starts at `started-at:`, else the stage named for its kind, else
  the first stage. A trigger's problem starts at the first stage, so its signal is checked.
- **Change it.** A repo reorders, adds, removes or renames stages under `pipelines:`.
  An optional stage with `when:` is decided by the agent; with none it runs only when
  asked (`canon run <id> --with <stage>`). `canon pipeline` shows the result.
- **Experiments** start anywhere: `canon new experiment checkout-retry --from design
  --to code`. Records made for one name it with `experiment:`.
- **Check first.** `verify: [sentry, "https://…"]` on a stage reads those sources
  before it runs. Wrong stops the run; a source that is down never counts as confirmed.
- **Approvals.** `canon approve` adds a person; `canon reject` sends the stage back
  with a reason. `approvers:` and `required:` limit who and how many. Code review
  stays on the pull request.
- **Versions.** Git versions all of it. `canon:` in `context.yaml` pins canon's
  version, and a run writes `rules:`, the commit it started under.

### What no config can change

An agent cannot approve, reject or close work past a gate. A stage passes only by being
done, or skipped with a reason. Connectors and checks only read. No key or event text is
stored. A run stops at its spend cap. IDs are unique, links resolve, locked values hold.
`canon check --status` lists what a repo has weakened. The real force is the CI job and
required reviews; a local hook can be skipped.

## `tasks.md`

Open work only, in order.

```markdown
# Tasks

## Now
1. [ ] T001 Add a screenshot mode  `feat:0002`  ~1d
2. [ ] T002 Write the capture flows  needs:T001  ~3h

## Parallel
- [ ] T004 Move the SKU IDs into the wiki  ~1h

## Blocked
- [ ] T005 Submit the iOS build
      blocked-by: store account access  since:2026-09-16
      unblock: ask for the role  next-check:2026-10-06

## Waiting
- [ ] T006 Second-language listing  wait:2026-11-01
```

Delete a task when it is done; the commit records it. No `## Done`, no session notes,
at most 100 lines. A blocker needs an unblocking action and a check date. A task that
needs more than a line is a feature.
