---
name: wildcard
disable-model-invocation: true
description: Generate ideas that are not only copies of what already worked — of every 10, 8 follow the repo's references and 2 deliberately break them. Use when asked for ideas, names, titles, approaches or options, or when the user types /wildcard. Usage `/wildcard <what you need ideas for>`.
---

You are generating ideas for: `$ARGUMENTS`

## Steps

1. Find the references: search the wiki, past ideas and what they led to, and any examples the user names. Note the patterns they share.
2. Write 10 ideas, or the number asked for. Make 2 of every 10 wildcards, rounding up, and at least 1.
   - **Following:** fits the patterns you found.
   - **Wildcard:** deliberately breaks one named pattern, and could still work.
3. Show the following ideas first, then the wildcards. For each wildcard, say in one line which pattern it breaks and why it might work.
4. Ask which to keep. Write a kept idea to `.context/ideas/` only when the user picks it, in the repo's normal format. Give a kept wildcard `wildcard: true` in its frontmatter.
5. When the user likes a wildcard, offer to add it to the references. Change them only if they say yes.

## Rules

- A wildcard is not a random or worse idea. If it could not work, replace it.
- Do not soften a wildcard until it follows the pattern. Do not reject it for breaking the pattern: that is its job.
- This only widens what gets considered. `weigh` and every approval gate still apply to whatever moves forward.
- If you find no references, say so and ask for examples. With none to break, there are no wildcards.
