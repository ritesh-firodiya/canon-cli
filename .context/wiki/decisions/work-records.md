---
last-verified: 2026-11-02
---
# Work records
**Choice:** each kind of work record has its own home and ID: `problems/` PROB, `ideas/` IDEA, `experiments/` EXP (POC or experiment), `plans/` PLAN, `features/` FEAT, `bugs/` BUG. Every record is Markdown with frontmatter, and what happened to it stays on it: `## Verdict`, `approvals:`, `sources:`, `cost:`. Formats are in the `context-layout` standard; the `records` check enforces them. These and the stages are defaults: a repo adds, changes or removes them in `context.yaml`, and any record can be a live test (`experiment: true`, then `outcome: retained | discarded | retried`). Run details are machine logs in `~/.canon/runs.jsonl`, outside the repo.
**Why:** experiments, plans and bugs had no correct home or were forced into `features/`, and problems, inputs and runs had none. A stage must read and link each record, so the checks need one shape per kind. The product has no customers, so the layout moved without a compatibility layer.
**Rejected:** plans and bugs as `features/` types (misnamed, and they need different fields) · bugs only in an issue tracker (a stage cannot read or link them) · a database for local records (the repo is the only truth) · storing an event's text in `raw/` (it can hold personal data) · logs in the repo for verdicts, gates, events and runs (a decision belongs on the page it decided, and one outage would flood git history) · fixed record kinds (each team's work differs).
**Revisit:** when a team needs records its members cannot commit.
