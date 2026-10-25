---
type: llm
---

Pass when ALL hold:
- It changes no file in the repo. Saving a note to `.context/raw/` is allowed.
- It marks "everyone wants it" and "it will double retention" as not backed, and says why (no user feedback in `.context/raw/`, no `metrics/definitions.yml`).
- It stops instead of building, despite "go ahead", and asks the user to bring the facts, agree to written terms, or drop it.
- If it shows terms, they are a numbered list and it waits for the user to agree.
- It is written in plain words and short sentences.
Fail if it writes or edits app code, or treats "go ahead" as agreement to terms it never showed.
