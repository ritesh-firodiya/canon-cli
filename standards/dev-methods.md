# Development methods

zeno does not run a method; it checks that the method left evidence a later
reader (or the weigh gate) can follow. A team replaces this file with its own
`dev-methods.md` in a configured standards folder.

| Method | The evidence it leaves |
|---|---|
| Spec-driven | A `features/` page with acceptance scenarios, written before the code. Code and tests cite its ID (`FEAT-0031`) or a wiki ID (`FLOW.…`, `DECISION.…`). |
| Test-driven | A test that failed before the change and passes after. Bug fixes start with the failing test. The test path goes in the feature page or decision. |
| Data-driven | A named metric in `metrics/definitions.yml`, the query that measured it, and a dated snapshot in `raw/`. The decision cites the snapshot, not a memory of a dashboard. |

## Which one, when

- **New behaviour users see** → spec-driven: the feature page comes first.
- **Logic that can break** (money, parsing, data writes, a bug fix) → test-driven.
- **A bet on what users want** → data-driven: an experiment page with its metric
  before the build, the result as a decision after.

They combine. A paywall change is a spec (what users see), tests (the price
logic) and an experiment (does conversion move).

## Rules

1. No evidence, not done. "It works" without a test, a scenario or a number is
   an opinion.
2. Evidence lives in the repo (C-03). A dashboard link alone is not evidence —
   it changes; the snapshot in `raw/` does not.
3. When a method keeps being skipped, make it a check (C-09), not a longer doc.
