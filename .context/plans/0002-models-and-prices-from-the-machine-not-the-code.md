---
id: PLAN-0002
status: building
priority: p2
last-verified: 2026-11-06
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
3. Done 2026-11-06. The band and `canon learn --cost` price from a fresh scan of the machine (config, then the list price of the model each id runs, else `?`). Family names resolve through the models recent sessions ran; the alias map is gone.
4. Remove the hardcoded tiers, keeping public list prices as the shipped default the config overrides. Waits for T010, with step 2.

## Rejected
- Keep the hardcoded table: wrong for every company with its own models.
- Fetch prices from a web page: no public price API; scraping breaks without warning.
- Jev or Laya as the classifier: see PLAN-0001.

## Verdict
- 2026-11-06 · do-it-differently · overridden · C-01, C-09, C-02, C-05, C-04, C-10 · Finish PLAN-0002 step 4 and mark it done
  - Reason: I do use canon on my work laptop they do have Claude through bedrock and curosr, codex and other models as well
  - Term: Band and canon learn --cost price from scanned models; no price shows ?, never $0
  - Term: Test with a Bedrock-style id
  - Term: Fix FEAT-0012 summary; correction line on IDEA-0008
  - Term: Routing (step 2) and tier removal (step 4) wait for T010; PLAN-0002 stays open
  - Term: Cursor, Codex and other non-Claude tools out of scope
  - Term: Always scan models, no hardcoded model list; prices: config, then public list price, else ?
