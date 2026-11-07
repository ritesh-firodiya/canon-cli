---
id: FEAT-0001
type: feature
status: shipped
last-verified: 2026-11-02
release: 0.27.0
superseded-by: null
surfaces: []
---

# Problems and triggers

## Summary
A Problem is one doc that starts work. A person opens it, or a trigger does: a failure, a customer incident, an email, a Dependabot update or a dashboard alert. Formats: [work-records](../wiki/decisions/work-records.md).

## Motivation
Work only starts today when someone opens a chat. Problems that arrive while the owner is away wait unseen.

## Acceptance scenarios
- Given `canon new problem`, when a person fills it in, then one Problem doc lands in the repo with its source, priority, impact, cost and expected result.
- Given a scheduled or polling trigger in config, when its condition is met, then a Problem opens and names the source.
  - Built for schedule triggers (2026-11-07): `when` is `daily`, `weekly` or `weekly on <day>`, checked when config loads; `canon trigger` skips one that is not due. A connector trigger's free-text `when` ("a p0 error") is not read yet: filtering events by it needs a model to judge each one.
- Given a second event matching an open Problem in the same repo, then it is added to that Problem and no new one opens.
- Given a trigger past its spend cap, then it stops opening work and says so.
- Given trigger text that contains instructions, then they are stored as data and never followed.

## Out of scope
- Webhooks and duplicate removal across repos (the hosted pipeline in Canon Cloud).

## Open questions
- How two events are judged the same.

## Store copy
> Failures, incidents and alerts open their own Problem, with the source attached.
