---
id: PLAN-0003
status: draft
priority: p2
last-verified: 2026-11-04
---
# One loop: know, enforce, decide, learn

## Approach
canon's purpose: learn from history, build knowledge, enforce the rules of a domain, org, team and person while coding, and help the person decide from their own history. It does this on its own: nobody chooses what is injected or written.

Organize the CLI, the skills and the code around one loop, each part with one job and named for what it does:

- **Know.** `ask` and `ingest`; `add`; `update` takes over `sync`. One knowledge gate every write passes, from a person, an agent or `ingest`: the page fits the wiki schema, each fact has one home (C-02), it is checked against what exists for duplicates and conflicts, and it fits a size budget per page and per session. What fails is proposed, never written.
- **Enforce.** One `check`; `status`, `copies` and `wiki-lint` fold into it, `standards` becomes `check --standards`; `hooks` runs it before a push. Hooks inject the rules and knowledge that fit the files and prompt at hand.
- **Decide.** `weigh` (with `wildcard` folded in) and `decision`; `verdict` writes weigh's result. The `weigh` command goes: the skill is the one home.
- **Learn.** `canon learn` becomes one report of history: gate overrides, how far work got (`flow`) and cost (`usage`). A `learn` skill turns it into proposed rule changes, and `weigh` reads it when advising.
- **Work.** `new`, `set`, `done`, `queue`, `work`, `pipeline`, `approve`, `reject`; `experiment` becomes `new experiment`. `run` and `trigger` are the automation and stay core.
- **Setup and cost.** `init`, `update`, `doctor`, `enable`, `disable`, `models`, the band.
- **Removed.** The `search` command (`ask` covers it), the `weigh` command, the canon-styles plugin (the band's reply size replaces it).

The code folders follow the same groups, with one shared `lib`; repeated code (transcript reading, config and settings reads, record lookup, CANON_HOME paths) has one home there.

## Baseline (2026-11-04, this Mac)
- Commands: 155–210 ms each, mostly Node start-up; `check` 207 ms, `band` 189 ms (the band runs it after every turn).
- Slow: `flow` 14.3 s and `usage` 11.3 s, each reading every transcript on its own.
- Every session: session-start text 1,331 chars (process 985, knowledge 346); seven skill descriptions 2,249 chars; the qmd server's instructions, which list every collection, about 3,800 chars. In all about 7,400 chars, near 1,900 tokens.
- Each typed prompt: the reply-size rule, about 150 chars.
- On use: the weigh skill is 9,570 chars (about 2,400 tokens), and session start tells the agent to run it on every non-trivial request.

## Steps
1. Measure first: command use from transcripts, so each cut rests on use; keep this plan's baseline as the yardstick.
2. One transcript reader with a cache, shared by `learn`, `flow` and `usage`. Target: under 2 s warm.
3. Fold commands: `status`, `copies` and `standards` into `check`; `sync` into `update`; `experiment` into `new`; remove `search`, the `weigh` command and canon-styles. Old names print where the command went for one release.
4. Move code into the six groups with one `lib`; no behaviour change, tests unchanged.
5. The knowledge gate: schema, one home, duplicate and conflict check, size budgets.
6. `learn` as one history report, and the `learn` skill feeding `weigh`.
7. Context diet: weigh's skill body under half, the qmd collection list out of the instructions, session-start text under 600 chars. Re-measure against the baseline.

## Rejected
- Cut `run`, `trigger`, `learn` and `flow` as unused: they are the automation and the learning that are canon's purpose.
- A person picks what is injected: canon must do it on its own.
- Leave the structure and only delete: the duplication would stay.
