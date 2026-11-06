---
last-verified: 2026-11-05
---
# Runtime

**Choice:** canon needs only Node, git and qmd, and runs inside Claude Code. It
ships rules, a gate and checks; Claude Code runs the agent. `canon run` starts work
through Claude Code, not its own loop. (Node only since 0.21.0, 2026-10-30, who: not
recorded; Claude Code only: owner, 2026-11-04.)

**Why:** a package installed from npm cannot depend on tools npm does not install
(0.21.0 ported the last Python and Ruby code). Claude Code's plugins already cover
running an agent.

**Rejected:**
- Python or Ruby for any command: npm does not install them.
- canon's own agent loop and LLM provider (the first version): Claude Code does it.
- Codex and Cursor support: Claude Code only, by the owner's choice.
- A config above the repos (the old estate layer): see [rule-layers](rule-layers.md).
