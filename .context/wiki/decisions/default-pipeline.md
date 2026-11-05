---
last-verified: 2026-11-03
---
# Default pipeline

**Choice:** the default flow is
`intake → (problem | idea | discovery) → prioritize → collect → research → design → plan → feature → code → review → release → outcome`
(owner, 2026-11-05).
- Problem, idea and discovery fork from intake: any of them, in any order, or none.
  Each is optional, with a `when:`.
- `after: [ids]` names the stages a stage may follow, which makes forks. With no
  `after:` a stage follows the one above it, so a plain list stays a line.
- A stage named like a default takes its wording, not its place.
- Work starts at `started-at:`, else the stage named for its kind, else the first stage.
- Every stage checks that what it was given is true before using it.
- A discarded or retried outcome opens a new problem at intake.

**Why:** canon ships one full template that teams change, so the schema must say
"start as an idea, open a problem later". The old flow had two stages writing to
`ideas/`, no stage setting `priority:`, research with no data stage before it,
design after the plan, and results that never fed new work.

**Rejected:**
- A straight list with optional stages: cannot order problem, idea and discovery.
- `any: [...]` groups, or both `any:` and `after:`: one cannot say "idea only after a problem"; two ways to say one thing.
- Signals as a record kind: `source:` holds them.
- An `after:` edge from outcome back to intake: every stage would come before and after every other.
- Aliases for old stage ids: no outside users; each product was renamed instead.
- Experiments writing skip entries: `started-at:` says where they begin.
