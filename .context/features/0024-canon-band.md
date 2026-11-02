---
id: FEAT-0024
type: feature
status: planned
priority: p2
last-verified: 2026-11-02
release: null
superseded-by: null
surfaces: []
plan: PLAN-0001
---

# Canon band

## Summary
A Claude Code mod in the canon plugin draws one band above the prompt: product, stage, what waits on you, checks, cost, usage left and the prompt cache, with a button to extend the cache.

## Motivation
The state of the work and its cost should be visible without asking, and colour should appear only when something needs the owner.

## Acceptance scenarios
- Given a design set approved by the owner, then the band matches it in all its states. No code starts before that approval.
- Given a warm cache and no reply running, then an extend button shows its estimated cost.
- Given a click on extend, then one tiny message is sent and the cache hour restarts.
- Given a cold cache or a running reply, then no extend button shows.
- Given a click anywhere on the band, then nothing is approved. Only extend spends anything.
- Given a folder that is not a product, then only usage and cache show.

## Out of scope
- Automatic cache pings ([[PLAN-0001]]).
- Approving a gate from the band.

## Open questions
- The mock-up removes the ribbon and ponytail plugins. Ribbon's band is replaced, but ponytail's rules still apply, so check what the band replaces in it.
- The mock-up marks running time, problem ID and spend as "needs T001". Check them against what 0.27.0 and FEAT-0020 now provide.
- The design is still in another session's scratch folder. Move it to `.context/designs/` as a Babul set when it is approved.

## Store copy
> See your stage, checks, usage and cache above the prompt, and extend the cache with one click.
