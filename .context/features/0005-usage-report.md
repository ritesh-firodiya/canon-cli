---
id: FEAT-0005
type: feature
status: shipped
priority: p2
last-verified: 2026-11-02
release: 0.30.0
superseded-by: null
surfaces: []
plan: PLAN-0001
---

# Usage report

## Summary
`canon usage` reads Claude Code's local transcripts and canon's run log, and shows what was used, when, for what and at what cost.

## Motivation
`/usage` gives shares only, and no view shows what is costly inside a skill. Nothing can be cut with confidence without a baseline.

## Acceptance scenarios
- Given a period, then it shows each skill's calls, last use, products and estimated cost.
- Given installed skills, then it lists the ones never used in the period.
- Given a skill, then its cost splits by tool and by token kind: input, output, cache write, cache read.
- Given a report, then it also shows totals by model, product, main session and subagent, plus cold-cache reloads and context at the first reply.
- Given canon runs, then their cost by stage is included.
- Given a reply stored on several transcript lines, then its usage counts once and all of its tool calls count.
- Given a line it cannot read, then the report says how many were skipped.
- Given any report, then it holds counts and costs only, never message text.

## Out of scope
- A hosted view, until a paying team asks.
- Billing figures: costs are estimates at list prices.

## Open questions
- Skill cost runs from the skill's call to the next person's message. Check this against real sessions before relying on it.

## Store copy
> `canon usage` shows which skills you use and where your tokens go.
