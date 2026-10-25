---
id: SOURCE.SENTRY
type: entity
status: canonical
last-verified: 2026-10-20
---

## Summary
Crashes and screen load times from the Streaks app, sent by the Sentry SDK.

## Canonical values
| Key | Value | Last changed |
|---|---|---|
| SOURCE.SENTRY.PROJECT | streaks-mobile | 2026-10-20 |
| SOURCE.SENTRY.ACCESS | mcp: sentry | 2026-10-20 |

## How to query
- "Is screen X slow?" — p95 load time of the `ui.load` span for that screen, last 30 days.
- "How many people use screen X?" — sessions that opened the screen, out of all sessions, last 30 days.
- "Does X crash?" — unresolved issues tagged with the screen, last 30 days.

## Sources
- [[2026-10-20-sentry-stats-screen]]
