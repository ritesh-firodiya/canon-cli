---
last-verified: 2026-11-04
---
# Reviews and evals

**Choice:** (owner approved PLAN-0005, 2026-11-04)
- Design reviews use EGM (google/elephant-goldfish-model): fresh reviewers check a
  spec before code. canon does not build its own.
- canon sticks to enforcing rules and knowledge in the repo: the knowledge gate,
  weigh on large prompts, knowledge beside each prompt.
- A release gates on the offline tests (`pnpm typecheck`, `pnpm test`, the band
  tests). The model evals in `evals/` run weekly, not per release.

**Why:** on 2026-11-04 weigh passed 2–3 of 9 evals and ran in about 3% of sessions,
while EGM's review is proven at scale. One full eval run is 54 agent sessions: too
slow and noisy to gate each release.

**Rejected:** canon's own design review or drift review (EGM does both).

**Revisit:** 2026-11-18. If the knowledge log and weigh refusals show no drop in
rework, cut canon back to the band and `check`.

**Rework** (owner, 2026-11-06): a record marked `contradicted: <date>` — its
verdict proved wrong, or a FEAT or BUG reopened within 14 days of done.
`canon learn --cost` shows weigh runs, refusals and verdict outcomes per week, and
the rework rate on records with a weigh verdict and without.
