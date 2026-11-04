---
id: FEAT-0025
type: feature
status: shipped
priority: p2
last-verified: 2026-11-02
release: 1.0.1
superseded-by: null
surfaces: []
plan: PLAN-0001
---

# Prompt routing

## Summary
The canon mod picks effort and model from each prompt, so simple work stops running on the largest model at high effort.

## Motivation
Opus is 99% of cost. Most of the saving must come from building on a smaller model, if quality holds, not from quick questions alone.

## Acceptance scenarios
- Given a repo without `features: [routing]` in its config, then nothing is sent to Haiku, nothing changes and no pick shows.
- Given a prompt in a repo that turned it on, then a Haiku call through the session's own login classifies it as small, medium or large, and the mod applies the result on `turn.step`.
- Given a session under way, then effort may change, while the model only moves up, because moving to another model misses the cache.
- Given a failed or unclear decision, then the session's own model and effort are used.
- Given a pick, then the band shows it, and the owner can override it.
- Given a pick, then it is logged for `canon usage`, without the prompt's text.
- Given a `canon run` agent or a headless session, then nothing is routed, so a stage's model and cap hold.
- Given `/model`, then it holds like a choice on the band.
- Given a prompt sized large, then the band refuses its first Edit, Write or changing Bash command until the weigh skill has run in that turn, and says why; reading is never held.
- Given a week of use, then cost and rework are compared with the baseline, and routing is removed if rework rose.

## Tested
On 2026-11-02, through `turn.step` on a 41,000-token session: changing effort kept the cache (41,210 read, 64 written). Changing model missed it (11,333 read, 31,788 written). The first model's cache stayed warm for the way back.

## Out of scope
- A proxy.
- Routing to other companies' models.

## Open questions
- Whether a local Laya classifier beats Haiku. Try it only if the classifier's cost shows up in `canon usage`.

## Store copy
> Canon picks the right effort and model for each prompt.
