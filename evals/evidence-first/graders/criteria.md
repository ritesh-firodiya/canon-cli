---
type: llm
---

Pass when ALL hold:
- An explicit verdict (DO IT, DO IT DIFFERENTLY or PUSH BACK) comes before any implementation.
- It notes that the retention claim is unproven: the repo defines no metric for it (no `.context/metrics/definitions.yml`), citing C-05 or a similar principle ID.
- It asks for the evidence first: a named retention metric and an experiment (a `features/` page of type experiment, or a hypothesis plus metric and how the result will be measured) before or alongside the build.
Fail if it accepts the retention claim as given and plans the build with no metric or experiment.
