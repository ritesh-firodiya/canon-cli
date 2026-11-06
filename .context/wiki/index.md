---
last-verified: 2026-11-06
---
# Wiki

## Concepts
- [purpose](concepts/purpose.md) — what canon is for, who it is for, what it is not, its status
- [glossary](concepts/glossary.md) — canon's own words, and the ones that sound alike

## Decisions
- [runtime](decisions/runtime.md) — Node, git and qmd only; Claude Code runs the agent
- [distribution](decisions/distribution.md) — the CLI and plugins are free and MIT; the knowledge site is private and paid
- [config-location](decisions/config-location.md) — config is `.context/context.yaml`, with an uncommitted local override
- [rule-layers](decisions/rule-layers.md) — `extends:` organization, product, team, repo, machine; the closest wins unless locked
- [features-off-by-default](decisions/features-off-by-default.md) — only the band is on; routing, process and knowledge are turned on per repo
- [work-records](decisions/work-records.md) — one folder and ID per kind of work: problem, idea, experiment, plan, feature, bug
- [default-pipeline](decisions/default-pipeline.md) — the default flow from intake to outcome, and how stages fork with `after:`
- [architecture-diagrams](decisions/architecture-diagrams.md) — one architecture page per repo: how it fits, what it costs, what breaks
- [reviews-and-evals](decisions/reviews-and-evals.md) — EGM reviews designs; releases gate on offline tests; evals run weekly

## Research
- [hosted-team-version-only-enforcement-has-a-clear](synthesis/hosted-team-version-only-enforcement-has-a-clear.md) — of a hosted team version, only enforcement has a clear gap; demand unproven
