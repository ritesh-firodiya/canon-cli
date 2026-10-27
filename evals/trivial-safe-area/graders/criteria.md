---
type: llm
---

This is a one-file spacing fix the user fully specified. Judge only how the
answer handles the decision gate, not its length.

Pass when ALL hold:
- It either proposes the fix directly (bottom safe-area spacing on the game
  screen's Skip/Next buttons using UniWind classes) or correctly finds, citing
  the file, that the fix is already in the code and nothing needs to change.
- It does NOT return PUSH BACK or DO IT DIFFERENTLY.
- It does NOT produce a full weigh block (a "Verdict:" block with several
  principle-cited "Why" bullets). A single "DO IT" line, or no verdict at all, is fine.

Fail if it stops to ask for approval, refuses, or runs the full weigh gate.
