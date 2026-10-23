---
id: DECISION.2026-10-23.CONFIGURABLE-DOC-KINDS
type: decision
status: canonical
last-verified: 2026-10-23
supersedes: []
superseded-by: null
---

## Decision
zeno grows by gap-fill, not a refactor. Teams extend page types and `.context`
folders in `zeno.yaml`; doc kinds map onto existing homes; dev methods ship as
standards; data sources are wiki entities backed by vendor MCPs or CLIs.

## Why
The ask: zeno should cover what a standard product needs (RFC, ADR, PRD,
experiments, initiatives, findings, bugs, know-hows; TDD, spec-driven,
data-driven; Datadog, Sentry, Snowflake) without being over-engineered.

Weighed on 2026-10-23 as DO IT DIFFERENTLY:
- Config is already layered and standards are replaceable (`cli/src/config/load.ts`).
- The real gap is C-02: `FOLDER_BY_TYPE` (`cli/src/checks/wiki-frontmatter.ts`)
  and `ALLOWED_FOLDERS` (`cli/src/checks/context-layout.ts`) are hardcoded, so a
  team that replaces `context-layout.md` or `wiki-schema.md` is still checked
  against zeno's lists.
- The `specs` module is declared but nothing reads it; `metrics` has no check.
- Each data vendor ships its own MCP server or CLI (C-07).

## Impact

### 1. Configurable types and folders
```yaml
wiki:
  types:                       # added to the six built-in types
    - { type: bug, folder: bugs, reason: "postmortems need their own shape" }
context:
  folders:                     # added to the ten built-in folders
    - { folder: research, reason: "raw interview notes, kept apart from raw/" }
```
- Additions only. Built-in types and folders cannot be removed or renamed.
- Every entry needs a `reason:` — the same rule as check overrides, so drift
  between products is written down (C-08).
- Lists merge across estate → product → local by key (`type`, `folder`).
- `wiki-frontmatter` and `context-layout` checks read the merged lists.

### 2. Where each doc kind lives (added to `context-layout.md`)
| Doc kind | Home |
|---|---|
| ADR | `wiki/decisions/`, `status: canonical` |
| RFC | `wiki/decisions/`, `status: draft` — the same page becomes the ADR |
| PRD | `features/`, `type: feature` |
| Experiment | `features/`, `type: experiment`; result recorded in a decision |
| Initiative | `wiki/synthesis/` linking its features and decisions |
| Finding | dated source in `raw/`, conclusion in `wiki/synthesis/` or a concept |
| Know-how | `wiki/concepts/`, or `ops/` when it is a runbook |
| Bug | the issue tracker; a wiki concept only when it teaches a rule |

Bug and initiative get their own type only when this mapping fails on a real
product — then via `wiki.types`, not a zeno release.

### 3. Dev methods as standards
`standards/dev-methods.md` (one file — standards are flat and replaced by name): what evidence
each method leaves (a test path, a page ID referenced from code, a query plus a
dated snapshot in `raw/`). No code until a method needs a check (C-09).

### 4. Data sources
One `wiki/entities/` page per source: what it holds, how to query it, who owns
it. A `doctor.tools` entry checks the MCP or CLI is installed. No adapters in zeno.

### 5. Modules
- `metrics`: one check — `.context/metrics/definitions.yml` exists (the weigh
  skill already reads it). A **warning**, and `metrics` leaves the default
  modules: on 2026-10-23 only 2 of the 12 products with metrics on had the file.
- `specs`: deleted. Nothing reads it; spec-driven is covered by item 3.

### Order
1, then 5, then 2–4 (docs only). Each step ships with tests and `zeno check` green.

## Status
Active — approved 2026-10-23.

## Sources
- Weigh verdict and challenger review, session of 2026-10-23
