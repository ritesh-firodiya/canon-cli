---
id: FEAT-0002
type: feature
status: shipped
last-verified: 2026-11-02
release: 0.27.0
superseded-by: null
surfaces: []
---

# Stage runner

## Summary
`canon-cli` runs a Problem through the repo's stages with Claude Code on the user's machine. It stops at each human gate and records the cost of each stage. Formats: [work-records](../wiki/decisions/work-records.md).

## Motivation
`canon learn --flow` shows where work stops but does not move it. The owner wants to approve gates, not drive each step.

## Acceptance scenarios
- Given a Problem and a pipeline in `.context/context.yaml`, when the runner starts, then it runs stages in order and writes each stage's output to the repo.
- Given an optional stage whose condition is not met, then it is skipped and the reason is recorded.
- Given a stage with a human gate, then the run stops until `canon approve` records a person's approval. An agent cannot approve.
- Given Idea or Plan, then the agent searches knowledge and past outcomes first, and Plan compares solutions through `weigh`.
- Given Plan, then its output is split into Feature or Bug pieces, each small enough to run alone.
- Given Review, then quality, consistency and security checks run before the human gate.
- Given a user-defined stage in config, then it runs like a built-in one.
- Given a run, then time and cost per stage are written to a local log. A stage past its cap stops and says so.
- Given a stopped run, then it resumes from the last finished stage.

## Out of scope
- Hosted runs (the hosted pipeline in Canon Cloud). A canvas.
- Marketing stages as built-ins.

## Open questions
- None.

## Store copy
> Run a problem through your own stages, and approve only the gates.
