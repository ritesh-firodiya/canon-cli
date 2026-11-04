---
id: PLAN-0005
status: draft
priority: p2
last-verified: 2026-11-04
problem: PROB-0001
approvals:
  - stage: plan
    by: Ritesh Firodiya
    at: 2026-11-04T17:09:03.714Z
    note: approved
---
# Lighter and fairer: learn from EGM

## Approach
EGM (google/elephant-goldfish-model) puts almost nothing in a session until it is called, and reviews with fresh agents that never saw the chat. canon runs on every prompt and write, so each part must be light and judge fairly. Five changes, each measured against today:

1. **Read-only by Claude Code's word.** Weigh's hold moves from `tool.call` to `tool.check`, whose `isReadOnly` the engine sets per call. The hand-written list of looking commands goes: it held `cd`, `d=$(…)` and `claude … --help` on 2026-11-04.
2. **Weigh as a fresh agent.** The weigh skill hands the request, the repo path and the facts the chat already holds to a read-only agent with no chat history, and shows only its verdict. Its 9,570-character steps and the pages it reads stay out of the session. EGM's reviewers work this way.
3. **Rare skills on call only.** `wildcard`, `wiki-lint`, `learn` and `ingest` get `disable-model-invocation: true`, like six of EGM's seven skills: about 1,000 characters less per session. None ran in the 30 days to 2026-11-04.
4. **No Idea for work that simply went ahead.** `canon verdict` with no `--record` and outcome `proceeded` appends to `~/.canon/verdicts.jsonl`, which `canon learn` reads too; the work itself records it. A stopped, dropped or overridden one still becomes an Idea, so a rejected request is not proposed again unseen (C-03).
5. **A faster gate.** The findings of the repo as it is are cached until a file under `.context/` changes, so a write runs the page rules once: from about 1.5 s to about 1.0 s on the largest product here (measured 2026-11-04: 1.9 s cold, 1.0 s warm).

## Steps
1. Read-only from `tool.check`; delete `isChangingCall` and its list. A test: a read-only Bash call passes a held prompt, a write does not.
2. Proceeded verdicts with no record go to `~/.canon/verdicts.jsonl`; `canon learn` reads both.
3. `disable-model-invocation` on the four rare skills; re-measure the session's skill text.
4. The gate's cache; re-time on the largest product.
5. Weigh as a fresh agent; the quick evals (`evals/run.sh`) must still pass 8 of 9, and the session's tokens per weigh are compared before and after.

## Rejected
- Build canon's own design review or drift check: EGM does both (`.context/wiki/decisions/reviews-and-evals.md`).
- Grow the read-only list: it will always miss a command; Claude Code already knows.
- Make weigh user-only too: then nothing runs it unasked, and the band's hold needs it.
- Support Codex and Cursor like EGM: Claude Code only, by the owner's choice.
