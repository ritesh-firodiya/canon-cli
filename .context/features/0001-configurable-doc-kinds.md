---
id: FEAT-0001
type: feature
status: building
last-verified: 2026-10-23
---
## Summary
Teams add wiki types and `.context` folders in config; every common document
kind, dev method and data source has one home. See DECISION.2026-10-23.CONFIGURABLE-DOC-KINDS.

## Motivation
Checks hardcoded the six types and ten folders, so a team's own standards were
ignored (C-02).

## Acceptance scenarios
- Given `wiki.types: [{type: bug, folder: bugs, reason: …}]`, when a bug page sits in `wiki/bugs/`, then `zeno check` passes.
- Given an added type with no reason, when zeno loads the config, then it fails and names `reason`.
- Given `modules: [metrics]` and no `metrics/definitions.yml`, when `zeno check` runs, then it warns and does not fail.

## Out of scope
Connectors to data tools; removing built-in types or folders.

## Open questions
None.
