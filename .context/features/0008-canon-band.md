---
id: FEAT-0008
type: feature
status: shipped
priority: p2
last-verified: 2026-11-02
release: 0.30.0
superseded-by: null
surfaces: []
plan: PLAN-0001
---

# Canon band

## Summary
A Claude Code mod in the canon plugin draws one band above the prompt: product, stage, what waits on you, checks, cost, usage left and the prompt cache, with a button to extend the cache.

The band shows a stage only for a record: the one you selected, one waiting on you, or one a run has moved. Click the record ID to list open work, select a record or open its page. An edit in a later stage's folder moves the selected record there, an unapproved gate in the way holds it, and only `canon approve` passes a gate. Click a stage to set it by hand.

## Motivation
The state of the work and its cost should be visible without asking, and colour should appear only when something needs the owner.

## Acceptance scenarios
- Given a design set approved by the owner, then the band matches it in all its states. No code starts before that approval.
- Given a warm cache and no reply running, then an extend button shows its estimated cost.
- Given a click on extend, then one tiny message is sent and the cache hour restarts.
- Given a cold cache or a running reply, then no extend button shows.
- Given a click anywhere on the band, then nothing is approved. Only extend spends anything.
- Given a folder that is not a product, then only usage and cache show.
- Given a session in a parent folder or moving between products, when it edits a file in a product or changes folder into one, then the band shows that product, with nothing to link.

## Out of scope
- Automatic cache pings ([[PLAN-0001]]).
- Approving a gate from the band.

## Open questions
- Turning off Ribbon and hiding Ponytail's band is the owner's choice, once this band has been seen working.

## Store copy
> See your stage, checks, usage and cache above the prompt, and extend the cache with one click.
