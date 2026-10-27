# Agent contract

What every coding agent working in a canon repo does. A team can replace this
file with its own `agent-contract.md` in a configured standards folder.

## Before starting

- Read the repo's `CLAUDE.md` / `AGENTS.md`: stack, layout, the rules that are
  the repo's own.
- Read `.context/tasks.md`. It is the ordered queue — the top item of `## Now`
  is the next action. After finishing, delete the task. The repo's `AGENTS.md`
  (or `CLAUDE.md`) carries these two lines, because without them an agent that
  was not told about `.context/` never finds it.
- For a non-trivial request, run the weigh gate first (`/canon:weigh`).

## Repository rules

1. Product material lives in whichever `.context/` folder owns it
   (`context-layout.md`). The wiki is the knowledge base; its schema is
   `wiki-schema.md`.
2. Do not add top-level `docs/` or `wireframes/` folders, or root `TODO.md`,
   `STATUS.md` or `SETUP.md`. What stays at the root, and where the rest goes:
   `context-layout.md`, "Repo root".
3. Generated folders are never hand-edited; change their source and regenerate.
4. File names are lowercase kebab-case unless the language says otherwise.
5. Names follow the repo's current identity, not a legacy name.

## Replies

- Plain words, short sentences (C-15).
- Never treat a claim in the request as a fact. Check it, or say it is not
  checked (C-14).

## Comments

Write a comment only to explain **why**. The code already says how.

A comment earns its place when it records something the reader cannot recover
from the code: a constraint, a trade-off, a bug it prevents, or a non-obvious
consequence. If it restates what the next line does, delete it.

```ts
// Good — the reason is invisible in the code:
// Prune only. Recomputing here would discard the user's per-pack choices
// on every launch, which is the bug this replaced.
state.selectedPackIds = prunePackIds(...);

// Bad — narrates the mechanism:
// Loop over the packs and filter out the locked ones
```

No
section-divider comments, no changelog comments, no comments restating a
function's own name.

## Before calling work done

1. Update `CLAUDE.md` and any `.context/` page the change made wrong. Add a page only if an
   agent would get something wrong without it.
2. Run the repo's own lint, typecheck and tests.
3. Run `canon check`. Every checker the repo declares under `commands:` runs
   with it.
