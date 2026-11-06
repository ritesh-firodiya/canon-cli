---
id: FEAT-0012
type: feature
status: shipped
priority: p2
last-verified: 2026-11-06
release: 4.0.0
surfaces: []
plan: PLAN-0002
---
# Models and prices from the machine

## Summary
`canon models` finds the models this machine can run and their prices, sorts each into small, medium or large, and writes `~/.canon/models.json`. `canon init` and `canon update` run it. The band and `canon learn --cost` price each model from the same scan, done fresh each time: a price from config wins, then the public list price of the model it runs, else `?`. A family name (`opus`) is priced as the model recent sessions ran in that family. Routing still picks `haiku`, `sonnet` and `opus` by name (PLAN-0002 step 2).

## Motivation
A company may run Claude through Bedrock, Vertex, a gateway or its own model ids. Today routing sends it to `haiku`, `sonnet` and `opus` by name and prices calls it cannot price at $0.

## Acceptance scenarios
- Given `availableModels`, `model`, `ANTHROPIC_MODEL` or an `ANTHROPIC_DEFAULT_*_MODEL` in Claude Code's settings or environment, then those ids are the list.
- Given `ANTHROPIC_API_KEY`, then the ids `/v1/models` returns are added.
- Given none of these, then the list is the family names Claude Code itself resolves: `haiku`, `sonnet`, `opus`.
- Given `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `_SONNET_` or `_OPUS_`, then that model is small, medium or large.
- Given `~/.canon/models.config.json` with `models: { id: size }` or `prices: { id: price }`, then those win over everything else.
- Given a model with no price from config or the shipped list prices, then its price is null and is shown as `?`, never $0.
- Given a model with no size, then it is listed but never routed to.
- Given recent sessions ran `us.anthropic.claude-opus-…`, then that id is listed, and `opus` is priced as it.
- Given a model id wrapped by Bedrock or Vertex, then the band and `canon learn --cost` price it as the model it wraps.
- Given an org's own name as the settings `model` (`acme.standard[1m]`), then it is sized and priced as the newest Claude model its sessions name, labelled as list price; with none named, `?`.

## Out of scope
- Routing by the scanned list instead of family names: PLAN-0002 step 2, after T010 decides whether routing stays.
- Fetching prices from the web: there is no price API.

## Open questions

## Store copy
> `canon models` lists the models your machine can run and their prices, including a company's own.
