---
id: FEAT-0003
type: feature
status: shipped
last-verified: 2026-11-02
release: 0.27.0
superseded-by: null
surfaces: []
---

# Connectors

## Summary
One format for reading a team's own tools, such as Sentry, Datadog and Jenkins, as both a trigger and knowledge for a stage. It builds on `SOURCE` pages. Formats: [work-records](../wiki/decisions/work-records.md).

## Motivation
A plan is only as good as what it can read. A company's facts live in its own tools.

## Acceptance scenarios
- Given a connector, then it is reached in the lightest way that works: the maker's tool, then a CLI, then its API, then an MCP server.
- Given a connector, then it reads only. Writing needs a new decision for that tool.
- Given a key, then it stays in the user's `.env`. It is never written to a page, a log or a chat.
- Given a connector returning names or customer data, then a saved result holds counts and rates only.
- Given a tool canon has never heard of, when a team names it in `connectors:` with how it is reached and its key names, then it works without a change to canon.

## Out of scope
- Stored customer logins and OAuth (the hosted pipeline in Canon Cloud).
- Docs and meeting capture, which are Canon Cloud's.
- Tools holding staff personal data, such as Workday.

## Open questions
- Which connector is first: the tool the first live product really uses (T002).

## Store copy
> Plans read your own tools, with your own keys.
