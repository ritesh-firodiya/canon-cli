---
last-verified: 2026-11-06
---
# Purpose

What canon is for, and how its parts fit. From PROB-0001 and the 4.0.0 restructure.

## What it is

An AI agent without written rules guesses a product's facts and decisions, and
work gets redone. canon gives each repo its rules and knowledge in `.context/`,
checks a request against them before work starts, and fails a check when code or
docs break them. It does this on its own: nobody picks what is injected or written.

## Who it is for

One person or a team building products with Claude Code, across several repos.
A new install only shows the band (usage and cache); the rest is turned on per repo
([features-off-by-default](../decisions/features-off-by-default.md)).

## The loop

| Part | Job | Where |
|---|---|---|
| Know | Find knowledge and keep one home per fact | the `ask` and `ingest` skills, `add`, `wiki`, `gate` (the knowledge gate) · `cli/src/know/` |
| Enforce | Hold code and docs to the rules | `check`, `hooks` · `cli/src/enforce/` |
| Decide | Weigh a request before work | the `weigh` and `decision` skills, `verdict` |
| Learn | Read history: overrides, how far work got, cost | `learn` (`--flow`, `--cost`) · `cli/src/learn/` |

Two groups support the loop:

- **Work:** `new`, `set`, `done`, `records`, `queue`, `pipeline`, `approve`,
  `reject`, `run`, `trigger` · `cli/src/work/`
- **Setup:** `init`, `update`, `doctor`, `enable`, `disable`, `models` · `cli/src/setup/`
- **Views:** `band`, `ui` and the wiki site · `cli/src/serve/`

Shared code has one home: `cli/src/lib/`.

## What it is not

- Not an agent. Claude Code runs the work ([runtime](../decisions/runtime.md)).
- Not a design reviewer ([reviews-and-evals](../decisions/reviews-and-evals.md)).
- Not the paid knowledge site ([distribution](../decisions/distribution.md)).

## Status

- Published as `@freetesh/canon` 5.1.0 on npm (checked 2026-11-06). No paying
  customers ([work-records](../decisions/work-records.md)).
- PROB-0001 is not solved: searching the knowledge before answering is asked, not
  enforced. PLAN-0003 is the next attempt.
- Words used here: [glossary](glossary.md).
