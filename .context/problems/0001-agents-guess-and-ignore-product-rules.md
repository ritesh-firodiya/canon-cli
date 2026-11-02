---
id: PROB-0001
status: solving
source: backfill
priority: p2
last-verified: 2026-11-02
---
# Agents guess and ignore product rules

## Summary
Without written rules in reach, an AI agent guesses at a product's facts and decisions, and work gets redone. The README states this as what canon is for. The first commit aimed at the same area: memory kept per repo, and tasks judged before they ran. The original reason was not written down at the time.

## Impact
Redone work for anyone building with agents. No count or cost was recorded.

## Expected
An agent searches a repo's knowledge before it answers, weighs a request against it before it acts, and `canon check` fails when code or docs break a rule.

## Evidence
- `README.md`, opening section
- 3d7e3a9: first version, repo memory and task evaluation
- 391d67d: rebuilt around the weigh gate and wiki skills
- 27d402f: the gate checks each claim against facts
