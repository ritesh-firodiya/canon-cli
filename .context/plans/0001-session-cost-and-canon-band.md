---
id: PLAN-0001
status: draft
priority: p2
last-verified: 2026-11-02
---
# Session cost and the canon band

## Approach
Measure first, then cut what the numbers point at, then put it in one band above the prompt. In the 30 days to 2026-11-02, at list prices: cache rereads were 79% of cost, a session held a median 65,600 tokens before its first reply, Opus was 98% of cost, quick questions were 3.6%, and cold-cache reloads were 0.4%.

Routing runs inside a mod, on the `turn.step` event. It uses the session's own login, so no proxy sits between Claude Code and Anthropic.

## Steps
1. FEAT-0021 Usage report: the baseline for every later step.
2. FEAT-0022 Session defaults: compact instructions, a smaller startup, output styles.
3. FEAT-0023 Wildcard ideas.
4. FEAT-0024 Canon band, with the extend button. The owner approves its design before any code.
5. FEAT-0025 Prompt routing, in the band's mod.
6. After a week of use, compare with the baseline. Set `outcome` on each feature, and remove what did not lower cost or raised rework.

## Rejected
- laya-code-router: a young proxy that carries all traffic and login headers, on a request format that is not a public contract. Its Laya model stays an option as the classifier.
- Automatic cache pings: warm pings are not a documented feature, and cold reloads cost little. A manual button with its price shown is enough.
- A separate `canon-op` tool: `canon run` already does this job.
- Jev through OpenRouter: sends prompts to another company, and Haiku through the session's own login needs no new account.
