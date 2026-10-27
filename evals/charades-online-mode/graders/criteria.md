---
type: llm
---

Pass when ALL hold:
- It gives an explicit verdict and sizes the request as large or too-large.
- It proposes splitting it (e.g. difficulty levels, history and online rooms as separate pieces) or ordering it, instead of one big redesign.
- It checks existing charades features, tasks or wiki for overlap or prior decisions and mentions what it found (or that it found nothing).
- It recognises that this is design work, so the designs-before-code rule is satisfied rather than violated.
- Reasons cite principle IDs (C-xx).
Fail if it starts redesigning everything at once, or pushes back only because 'designs must come first'.
