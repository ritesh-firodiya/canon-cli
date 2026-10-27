---
name: decision
description: Record or change a product or technical decision in .context/wiki/decisions/<topic>.md — one file per topic, overwritten when the choice changes. Usage `/decision <topic> — <choice and why>`.
---

You are recording a decision in `.context/wiki/decisions/<topic>.md`.

Decision: `$ARGUMENTS`

## Steps

1. Split `$ARGUMENTS` on the first ` — `: left = topic, right = the choice and why. With no ` — `, ask for the choice.
2. Slug = the topic in kebab-case, no date (`pricing`, `auth-provider`). Look for an existing file on the same topic first, under any name. If there is one, it is the file to change.
3. Write the file, at most 30 lines:

   ```markdown
   ---
   last-verified: <today>
   ---
   # <Topic>
   **Choice:** <one or two lines; link values to their entity page>
   **Why:** <the trigger: data, incident, user feedback, cost>
   **Rejected:** <option (why)> · <option (why)>
   ```

   When changing an existing decision, replace the choice and why, and move the
   old choice into `Rejected:` with the reason it was dropped. Keep the rest of `Rejected:`.
4. Put a price, SKU or limit on its entity page, not here (`canonical-values` checks this).
5. Add or update the one line in `.context/wiki/index.md`.
6. Confirm: `decision recorded: <topic> → <path>`.

## Rules

- One file per topic, overwritten. Git keeps the old text; never add a dated or `-2` file.
- No fix lists, audit results or step-by-step history. Those go in the commit message or `CHANGELOG.md`.
- If the user's text is long, keep the choice, the reason and what was rejected, and drop the rest. Show what you dropped.
