---
last-verified: 2026-11-04
---
# Reviews and evals

## Decision
- Design reviews use EGM (google/elephant-goldfish-model): fresh reviewers with no context check a spec before code. canon does not build its own design review.
- canon keeps to enforcing rules and knowledge in the repo: the knowledge gate, weigh on large prompts, knowledge beside each prompt.
- A release gates on the offline tests (`pnpm typecheck`, `pnpm test`, the band tests). The model evals in `evals/` run weekly, not per release: one full run is 54 agent sessions.

## Why
On 2026-11-04 weigh passed 2–3 of 9 evals and had run in about 3% of sessions, while EGM's review is proven at scale. Paying minutes and dollars per release bought a noisy score.

## Revisit
2026-11-18: if the knowledge log and the weigh refusals show no drop in rework, cut canon back to the band and `check`.
