---
id: FEAT-0010
type: feature
status: shelved
priority: p2
last-verified: 2026-11-02
release: null
surfaces: []
---
# Stages that fork and join

## Summary
A pipeline can fork and join: a stage can name what it comes after, so two stages can run side by side, and a person can draw that in Canon's pipeline builder.

## Motivation
Today stages run one after another from a list (`run.ts`). Real work forks, such as Android and iOS, and joins before release.

## Acceptance scenarios
- Given a pipeline that sets no connections, then it runs as an ordered list, as it does today.
- Given a stage naming what it comes after, then it runs once those stages finish.
- Given a stage nothing leads to, or one after itself, then loading the config fails and names it. Loops among forked stages are allowed; work loops back through a new record, not an edge.
- Given two stages running at once, then each keeps its own cost, cap and gate, and one stopping does not lose the other's work.
- Given `canon pipeline`, then it shows forks and joins.
- Given records, flow and the band, then they still work on a pipeline that forks.

## Out of scope
- Canon's canvas, which is in Canon.

## Open questions
- The config format.
- Whether two agents may change one repo at once.

## Store copy
> Run stages side by side, then bring them back together.
