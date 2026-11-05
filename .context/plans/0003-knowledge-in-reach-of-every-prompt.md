---
id: PLAN-0003
status: building
priority: p2
last-verified: 2026-11-04
problem: PROB-0001
---
# Knowledge in reach of every prompt

## Approach
PROB-0001's Expected has three parts. Since 4.0.0 two hold: `canon check` and the knowledge gate fail on broken rules, and weigh is enforced on large prompts. Two gaps stay: searching the knowledge before answering is only asked, and weigh is enforced only where routing is on.

1. **Knowledge beside each prompt.** On each typed prompt in a product with `knowledge` on, the band runs `qmd search` (keywords, 0.1 s, no model call) on the prompt's words, in that product's collection, and attaches the top three pages that score above a floor: title and path, never their text. The agent sees what exists before it answers; nobody chooses what is injected. Nothing is attached when nothing scores.
2. **Weigh without routing.** Where `process` is on and routing is off, the band still asks Haiku for the size, for weigh alone, and changes no model or effort. The same refusal holds a large prompt's first change until weigh has run.
3. **Measure.** Log what was attached and whether the agent opened it; after a week, check that answers cite the attached pages and that rework fell. Remove step 1 if the pages are mostly ignored.

## Steps
1. A feature: knowledge beside each prompt, with its log.
2. A feature: weigh sizing without routing.
3. After a week of use, PROB-0001 is solved if answers cite the knowledge and work is weighed; else this plan says what to try next.

## Rejected
- Attach the pages' text: it would cost context on every prompt; a title and a path are enough to open it.
- `qmd query`: better ranking, but about 6 s per prompt with a model call.
- Refuse an answer until qmd was queried: Claude Code gives no hook between thinking and replying.
