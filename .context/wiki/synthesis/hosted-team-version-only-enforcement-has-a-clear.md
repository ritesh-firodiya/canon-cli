---
last-verified: 2026-11-02
ideas: [IDEA-0001]
source: backfill
---
# Hosted team version: only enforcement has a clear gap

## Finding
A first pass on a hosted team version of the product found the wiki, search and editor parts crowded. Enforcement against written rules, weighing a request before work starts and failing CI, was the only part with a clear gap. Whether anyone would pay was not proven.

## Proof
Desk research on 2026-10-25, from web search. Most sources were vendor blogs, and prices were not checked. No buyer was asked. To read it: `git show 3fddc64:.context/raw/2026-10-25-market-research-teams.md`. It was removed from the tree in 0abbdcd. Its prices are old, so check them again before use.

## Verified by
Nobody. The research says itself that it is not proof of market fit. This repo has no record that its proposed buyer talks or pilot ran.

## What it means
Treat paying demand as unknown, and read [distribution](../decisions/distribution.md) with that in mind. The research named GitHub's organization-wide agent instructions, included with Copilot, as the biggest threat. See IDEA-0001.

## Evidence
- 3fddc64
- 0abbdcd
