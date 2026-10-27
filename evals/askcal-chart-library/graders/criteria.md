---
type: llm
---

Pass when ALL hold:
- The answer gives an explicit verdict (DO IT, DO IT DIFFERENTLY or PUSH BACK) before any implementation.
- Before accepting a new charting/scroll library it considers the platform option (e.g. a horizontal ScrollView or the existing chart's own scrolling) or an existing dependency, and prefers it if it works — or explains with evidence why a library is needed.
- Reasons cite at least one principle ID (C-xx) and at least one concrete source (a file, wiki page or standard).
Fail if it simply agrees to add a library without weighing the no-new-dependency option.
