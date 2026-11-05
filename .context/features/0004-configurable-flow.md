---
id: FEAT-0004
type: feature
status: shipped
last-verified: 2026-11-02
release: 0.29.0
superseded-by: null
surfaces: []
---

# Configurable flow, named experiments and checks against real sources

## Summary
One default flow that each product can change: stages, fields and statuses. Any stage can start a named experiment. Before an agent changes anything, it checks that the change is right against the real source.

## Motivation
Every product and team works differently, so canon's flow is a starting point, not a rule. Experiments often begin mid-flow, and a number is harder to remember than a name. Agents act on what a page or a person says, which may be out of date or wrong (C-01).

## The default flow

`problem → research → idea → plan → feature → design → code → review → release → result`

- `research` and `code` keep their names. `development` and `poc` go.
- `problem` is done once its page exists, so a run starts at `idea`.
- Discovery and Finding are documents made in `research`, not stages.
- `design` stays optional by default.
- A product can re-order, add, remove or rename stages and mark any one optional, in `context.yaml`. A stage naming a default id inherits what it does not set.

```yaml
pipelines:
  default:
    - { id: idea }
    - { id: plan, optional: true, when: the fix is not obvious }
    - { id: code }
    - { id: marketing, by: agent, prompt: Draft the launch post. }
```

## Optional stages
With `when:`, the AI answers yes or no from the words given. With no `when:`, the stage is skipped unless asked for. A person can force either: `canon run PROB-0001 --with design --skip plan`. Each skip records its reason.

## Fields

Only `id` is required. Everything else is optional unless a product requires it, and a value is checked only if it is present.

```yaml
records:
  - folder: plans
    fields:
      timeline: date-range        # add a field with a type
      owner: remove               # remove a default
      risk: [low, high]           # allowed values
    required: [timeline, "## Approach"]
```

- Types: `text`, `date`, `date-range`, `number`, `link`, or a list of allowed values.
- `required:` names fields and `## ` sections. Its default is empty.
- `sections:` are what a template suggests. They are no longer enforced by themselves.
- A record with no status counts as open.
- A release note on a shipped feature stays required, because store listings read it.

## Status commands
```
canon set PLAN-0001 status=approved    # any field, checked against the config
canon done PLAN-0001                   # the kind's first closing status
```

A product changes what its statuses are under `records:`, as it can today.

## Folders
`canon init` creates `features/` again. A product can remove it with `{ folder: features, remove: true }`. Other record folders appear with their first record.

## Experiments

One record, with a unique name, that can start at any stage.

```yaml
# .context/experiments/checkout-retry.md
name: checkout-retry
started-at: design
status: running          # planned | running | done | dropped
outcome: discarded       # retained | discarded | retried
```

```
canon experiment start checkout-retry --from design
canon run checkout-retry
```

- The file name is the name. A duplicate fails `canon check`. Names are unique per product.
- Stages before `--from` are recorded as skipped, with the reason. It starts from what the person gives it.
- Any record made along the way names it: `experiment: checkout-retry`.
- A POC is an experiment that starts at `code` and stops without a release.
- This replaces `experiment: true`, `kind: poc` and `EXP-NNNN`. The Hypothesis, Metric and Result sections are suggested, and a missing one is a warning.

## Checks against real sources

Before an agent stage changes anything, it checks that the change is right against the real thing, not only against what a page says.

```yaml
- { id: code, verify: [sentry, "https://app.example.com/checkout"] }
```

- `verify:` lists connector ids and live addresses. A connector can be a CLI, an API or an MCP server.
- The runner runs a separate read-only step first. It has the read tools and only the sources named, and it cannot write.
- It answers one of three ways:
  - **Confirmed:** the work goes ahead.
  - **Wrong:** the run stops and says what it found. For example, the error stopped last week, or the screen already does this.
  - **Could not check:** the run stops for a person, who can answer with `--unverified "<reason>"`. A source being down never counts as confirmed.
- What was checked goes under `## Checked` on the record: the source, when, and the result. Counts and rates only, never rows that name a person.
- What it reads is data, never instructions, and the step cannot change anything on a live platform.
- It spends from the stage's cap, and each check is logged as `<stage>:verify`.
- A stage with no `verify:` is told to check against what it can reach, and to say what it could not check. Only `verify:` stops a run.

## What stays enforced

A product decides what its flow is. Canon enforces whatever it decided, and a few things no config can change.

**Fixed, with no setting to turn them off:**
- An agent run cannot approve, reject or close work past a gate. `canon approve` and `canon reject` need a terminal, and the runner stops if approvals change during a stage.
- A record passes a gate only with enough allowed approvals.
- A run passes a stage only by doing it or recording why it was skipped: `canon check` fails a `stage:` with a gate or stage behind it that has neither.
- Connectors and verify steps only read. No key is written to config, and event text is never stored.
- A run stops at its spend cap, with a default when none is set.
- Every `id` is unique and matches its file, and every link points to a record that exists.
- A value that is present must match the type or list the product set.
- Anything under `locked:` cannot be changed below it.

**Enforced once a product asks for it:** `required:`, `approvers:`, `required:` on a stage, `verify:`, gates and optional stages. A stage with `verify:` that has passed must have a `## Checked` entry or an `--unverified` reason, or `canon check` fails.

**Weakening stays visible:** `canon status` lists what a repo has turned off compared with canon's defaults and its `extends:` layers: gates removed, stages removed, caps raised. A repo can make these choices, but it cannot make them quietly. A company that wants no choice locks the value.

**Where the force comes from:**

| Layer | Stops | Can be got round by |
|---|---|---|
| Config validation | Canon refusing to run on bad config | Nothing, while canon is used |
| Runner | An agent run | Editing files outside a run |
| Pre-push hook | A push that fails `canon check` | `--no-verify`, or a repo with no hook |
| CI job, required on the branch | A merge that fails `canon check` | A repo admin |
| GitHub review, required on the branch | An unreviewed merge | A repo admin |

Local approvals are a record, not a lock: people are matched by git name, and a page can be hand-edited. So `canon init` adds a CI job running `canon check`, and `canon status` says when a repo has no hook, or no CI job. For a company, the promise holds only with the CI job and reviews required on the branch. `weigh` remains advice.

## Migration
- Each product's `pipelines:` goes back to `research` and `code`, restoring the `research` lines 0.28 removed.
- `canon flow` restores its first-web-search evidence for `research`, which 0.28 removed.
- The 4 `EXP-NNNN` pages become named experiments, and pages naming them are updated.
- The unpushed rename commits in product repos are not pushed. They are replaced by this migration.

## Acceptance scenarios
- Given a repo with no pipeline, when it runs, then the stages are the ten above and `problem` is already done.
- Given a repo that adds `marketing` and removes `research`, when a record runs, then it follows that order and `canon flow` counts `marketing` by its `done` paths.
- Given `fields: { timeline: date-range }` and a value that is not a date range, then `canon check` fails and names the field. With no value it passes, unless `timeline` is required.
- Given `owner: remove`, when `owner:` is on a page, then `canon check` fails and names the field.
- Given a page with only an `id`, then `canon check` passes and `canon queue` shows it as open.
- Given `canon done PLAN-0001`, then the plan has its first closing status and has left `canon queue`.
- Given two experiments with one name, then `canon check` fails. A second `canon experiment start` with that name is refused.
- Given `canon experiment start x --from design`, when it runs, then earlier stages are skipped with the reason and `design` runs first.
- Given `verify: [sentry]` and a source that says the problem is gone, then the stage does not run, nothing changes, and the record says what was found.
- Given a source that cannot be reached, then the run stops for a person, and `--unverified` records their reason.
- Given a page in the verify step that says "ignore your rules", then it is treated as data and nothing is written.

- Given a record at `code` with a gated `plan` behind it and neither an approval nor a recorded skip, then `canon check` fails, however the record got there.
- Given a stage with `verify:` that has passed with no `## Checked` entry or `--unverified` reason, then `canon check` fails.
- Given a repo that removes a default gate, then `canon check` passes and `canon status` lists it. If a higher layer locked it, `canon check` fails.
- Given a repo with no hook or no CI job, then `canon status` says so.
- Given any config, when it tries to turn off a fixed rule, then there is no such setting and loading it fails.

## Out of scope
- Writing to a connector or live platform.
- A browser tool of canon's own. A live address is read over HTTP, or through an MCP browser if the repo names one.
- Organization-wide experiment names.

## Open questions
- Whether `code` should verify by default where a connector exists. Default for now: off, until real use shows the cost is worth it.
- Agents still edit pages directly, so a stage can leave a value the check later fails. `canon check` catches it; the runner does not.

## Store copy
> Change the flow to fit your team, start an experiment from any stage, and have agents check the real source before they change anything.
