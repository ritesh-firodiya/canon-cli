---
last-verified: 2026-11-06
---
# Glossary

The words canon uses in its own way. Several sound alike; this page keeps them apart.

| Word | Means here | Not to be confused with |
|---|---|---|
| band | The line above the prompt in Claude Code: usage, cost, cache, and the current work. On by default. | a status line you set up yourself |
| check | `canon check`: runs every check a repo uses and fails on errors. One check has an id, like `refs`. | the `Check:` line under a rule, which says how to test that rule |
| concept | A wiki page in `concepts/`: a rule, an invariant, a journey, the purpose or this glossary. | an idea (`ideas/`), which is a proposed change |
| constitution | The rules every request is weighed against, C-01 to C-13 (`standards/constitution.md`). | a standard, which says how work is done |
| decision | A wiki page in `decisions/`, one per topic: Choice, Why, Rejected. | a verdict, which judges one request |
| entity | A wiki page in `entities/` holding exact values: a price, a limit, a data source. | a record |
| feature (canon) | A part of canon a repo turns on: `routing`, `process`, `knowledge`. Off by default. | a feature record (`FEAT-NNNN`), which is product work |
| gate | 1. A pipeline stage a person must approve. 2. The knowledge gate, which refuses a wiki page that breaks the rules before it is written. | `weigh`, which judges a request |
| kind | What a repo is: `mobile`, `web`, `mobile-and-web`, `package`, `content`. Sets its default modules. | a record kind (problem, idea, plan…) |
| layer | A rules file a repo builds on with `extends:` (organization, product, team) ([rule-layers](../decisions/rule-layers.md)). | a folder above the repo, which canon never reads |
| module | A group of checks a repo runs: `docs`, `design`, `knowledge`, `metrics`, `code`, `architecture`, `listing`, `refs`. | a feature (canon) |
| Plain Context | canon's way to organize and write a product's knowledge: `standards/context.md` and `standards/writing.md`. | |
| product | One repo canon checks. | a sibling product: another repo on the same machine, never named in this public repo |
| record | A work page with an ID: problem, idea, experiment, plan, feature, bug ([work-records](../decisions/work-records.md)). | a wiki page, which says what is true now |
| stage | One step of a pipeline, like `research` or `review` ([default-pipeline](../decisions/default-pipeline.md)). | a status, which is a record's state |
| standard | A rules file in `standards/`. Defaults apply to every repo; library standards (`standards/library/`) only when a repo names them. | the constitution |
| verdict | weigh's answer to one request: do it, do it differently, or push back. Written on the record it judged. | a decision |
| weigh | The skill that checks a request against the constitution and the repo's knowledge before work starts. | `canon check`, which checks files |
