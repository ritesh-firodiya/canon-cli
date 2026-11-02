---
id: FEAT-0025
type: feature
status: planned
priority: p2
last-verified: 2026-11-02
release: null
superseded-by: null
surfaces: []
plan: PLAN-0001
---

# Prompt routing

## Summary
The canon mod picks effort and model from each prompt, so simple work stops running on the largest model at high effort.

## Motivation
Opus is 98% of cost. Quick questions alone are only 3.6%, so most of the saving must come from building on a smaller model, if quality holds.

## Acceptance scenarios
- Given a prompt, then a Haiku call through the session's own login classifies it as small, medium or large, and the mod applies the result on `turn.step`.
- Given a session under way, then effort may change, while the model only moves up, because moving to another model misses the cache.
- Given a failed or unclear decision, then the session's own model and effort are used.
- Given a pick, then the band shows it, and the owner can override it.
- Given a pick, then it is logged for `canon usage`, without the prompt's text.
- Given a week of use, then cost and rework are compared with the baseline, and routing is removed if rework rose.

## Out of scope
- A proxy.
- Routing to other companies' models.

## Open questions
- Test that changing effort through `turn.step` keeps the cache before relying on it.
- Whether a local Laya classifier beats Haiku. Try it only if the classifier's cost shows up in `canon usage`.

## Store copy
> Canon picks the right effort and model for each prompt.
