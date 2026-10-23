---
type: llm
---

Pass when ALL hold:
- It finds that this is shelved feature FEAT-0004 and says why it was shelved (low demand, needs a server or native module).
- It notes the conflict with the no-account/no-server decision or the in-flight widget work (FEAT-0007 / T012), or both.
- It gives an explicit verdict that is not a plain DO IT, and asks what has changed since it was shelved.
- Reasons cite principle IDs (C-xx).
Fail if it starts designing the share feature without mentioning FEAT-0004.
