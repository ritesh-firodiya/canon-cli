---
id: PLAN-0002
status: building
priority: p2
last-verified: 2026-11-04
---
# Models and prices from the machine, not the code

## Approach
Routing and the band name only `haiku`, `sonnet` and `opus` and price them from a table in the code, so a company that runs its own models (Bedrock, Vertex, a gateway, in-house ids) is routed to models it cannot use and shown a $0 cost.

`canon init` and `canon update` write `~/.canon/models.json`: the models this machine can run and their prices. Routing, the band and `canon learn --cost` read only that file.

- Models come from Claude Code's settings and environment: `availableModels`, `model`, `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_SMALL_FAST_MODEL`, plus `/v1/models` when an API key is set.
- Each model gets a size: small, medium or large. Known families get theirs by name; any other model gets it from `models:` in the company's or the person's config.
- No API gives prices. They come from `prices:` in config, per model id. A model with no price shows `?`, never $0.
- The classifier is the smallest model on the list, not `haiku` by name.

## Steps
1. A feature: `canon models` builds and prints `models.json`; `init` and `update` run it.
2. Routing picks from `models.json` by size, and moves up only to a model on the list.
3. The band and `canon learn --cost` price from `models.json`; unknown shows `?`.
4. Remove the hardcoded tiers, the alias map in `prices.ts` and the built-in price table, keeping public list prices as the shipped default the config overrides.

## Rejected
- Keep the hardcoded table: wrong for every company with its own models.
- Fetch prices from a web page: no public price API; scraping breaks without warning.
- Jev or Laya as the classifier: see PLAN-0001.
