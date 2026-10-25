# Agent contract

What every coding agent working in a zeno repo does. A team can replace this
file with its own `agent-contract.md` in a configured standards folder.

## Before starting

- Read the repo's `CLAUDE.md` / `AGENTS.md`: stack, layout, the rules that are
  the repo's own.
- Read `.context/tasks.md`. It is the ordered queue — the top item of `## Now`
  is the next action. After finishing, tick the task and append a Session Note.
- For a non-trivial request, run the weigh gate first (`/zeno:weigh`).

## Repository rules

1. Product material lives in whichever `.context/` folder owns it
   (`context-layout.md`). The wiki is the knowledge base; its schema is
   `wiki-schema.md`.
2. Do not add top-level `docs/` or `wireframes/` folders, or root `TODO.md`,
   `STATUS.md` or `SETUP.md`. Files a host or tool reads by exact path —
   `README.md`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`,
   `.github/` — stay at the root.
3. Generated folders are never hand-edited; change their source and regenerate.

## Replies

- Plain words, short sentences (C-15).
- Never treat a claim in the request as a fact. Check it, or say it is not
  checked (C-14).

## Comments

Write a comment only to explain **why**. The code already says how.

A comment earns its place when it records something the reader cannot recover
from the code: a constraint, a trade-off, a bug it prevents, or a non-obvious
consequence. If it restates what the next line does, delete it. No
section-divider comments, no changelog comments, no comments restating a
function's own name.

## Before calling work done

1. Reflect changed behaviour in `CLAUDE.md` and any affected `.context/` page.
2. Run the repo's own lint, typecheck and tests.
3. Run `zeno check`. Every checker the repo declares under `commands:` runs
   with it.
