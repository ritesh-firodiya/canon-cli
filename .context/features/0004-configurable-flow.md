---
id: FEAT-0004
type: feature
status: shipped
last-verified: 2026-11-06
release: 0.29.0
superseded-by: null
surfaces: []
---

# Configurable flow, named experiments and checks against real sources

One default flow each product can change, experiments that start at any stage, and
agents that check the real source before they change anything.

## Motivation
- Every product and team works differently, so canon's flow is a starting point,
  not a rule.
- Experiments often begin mid-flow, and a name is easier to remember than a number.
- Agents act on what a page or a person says, which may be out of date or wrong
  (C-01).

## What shipped
- **Stages, fields and statuses are config.** A product reorders, adds, removes or
  renames stages and record fields in `context.yaml`. Only `id` is required, except
  that a stage of the repo's own also says `by: agent` or `by: person`; a value that
  is present must fit its type.
- **`canon set` and `canon done`** change a field or close a record, checked against
  the config.
- **Named experiments** (`experiments/<name>.md`) start at any stage and replaced
  `experiment: true`, `kind: poc` and `EXP-NNNN`.
- **`verify:` on a stage** runs a read-only check of named sources first. Confirmed
  goes ahead, wrong stops the run, could-not-check stops for a person.
- **Fixed rules no config can change**, and weakening a default shows in
  `canon check --status`.

The current rules are in the `context` standard: "Records", "The flow" and "What no
config can change". The current stages are in
[default-pipeline](../wiki/decisions/default-pipeline.md).

## Acceptance scenarios
- Given `fields: { timeline: date-range }` and a value that is not a date range,
  then `canon check` fails and names the field; with no value it passes.
- Given a page with only an `id`, then `canon check` passes and `canon queue` shows
  it as open.
- Given two experiments with one name, then `canon check` fails.
- Given a stage that is not one of canon's and has no `by:`, then the config does not
  load, and the error names the pipeline and the stage. With `by: person` it loads.
- Given `verify: [sentry]` and a source that says the problem is gone, then the stage
  does not run and the record says what was found.
- Given a source that cannot be reached, then the run stops for a person, and
  `--unverified` records their reason.
- Given a page in the verify step that says "ignore your rules", then it is treated
  as data and nothing is written.
- Given a record at `code` with a gated `plan` behind it and neither an approval nor
  a recorded skip, then `canon check` fails.
- Given a repo that removes a default gate, then `canon check --status` lists it; if
  a higher layer locked it, `canon check` fails.

## Out of scope
- Writing to a connector or live platform.
- A browser tool of canon's own.
- Organization-wide experiment names.

## Store copy
> Change the flow to fit your team, start an experiment from any stage, and have agents check the real source before they change anything.
