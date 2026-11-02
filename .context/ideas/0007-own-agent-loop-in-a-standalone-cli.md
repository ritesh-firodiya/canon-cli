---
id: IDEA-0007
status: dropped
last-verified: 2026-11-02
problems: PROB-0001
source: backfill
---
# Own agent loop in a standalone CLI

## Summary
Zeno 0.1: a CLI that scanned a repo, kept memory in `.zeno/`, judged tasks, and ran them through its own agent loop and LLM provider.

## Verdict
Dropped at the rebuild. Claude Code's plugin system covers that ground, so canon ships rules, a gate and checks, and leaves running an agent to Claude Code. `canon run` later came back to running work, but through Claude Code, not an own loop ([[distribution]]).

## Evidence
- 3d7e3a9: the first version
- 391d67d: removed, with the reason in the commit message
- 8451f90: `canon run`
