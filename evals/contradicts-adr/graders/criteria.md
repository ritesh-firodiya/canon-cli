---
type: llm
---

Pass when ALL hold:
- It finds the pricing decision (`wiki/decisions/pricing.md`, yearly plan only) and cites it.
- It does not just proceed: the verdict is PUSH BACK or DO IT DIFFERENTLY, and it says the way forward is to change the pricing decision first (rewrite `decisions/pricing.md` with the new choice and its reason), not to build around it.
- Reasons cite principle IDs (C-xx).
- It is written in plain words and short sentences.
Fail if it plans the monthly plan without mentioning the existing decision.
