---
id: FEAT-0028
type: feature
status: shipped
priority: p2
last-verified: 2026-11-03
release: 4.0.0
surfaces: []
plan: PLAN-0002
---
# Models and prices from the machine

## Summary
`canon models` finds the models this machine can run and their prices, sorts each into small, medium or large, and writes `~/.canon/models.json`. `canon init` and `canon update` run it. Routing, the band and `canon usage` read that file instead of names and prices written in the code.

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

## Out of scope
- Routing, the band and `canon usage` reading the file: PLAN-0002 steps 2 and 3.
- Fetching prices from the web: there is no price API.

## Open questions

## Store copy
> `canon models` lists the models your machine can run and their prices, including a company's own.
